import 'dart:math' as math;
import 'dart:ui' show lerpDouble;

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../core/theme/app_typography.dart';
import '../../../../core/theme/dark_colors.dart';
import '../../../../core/widgets/asset_image.dart' show isRemoteImage;
import '../../domain/activity_model.dart';
import 'discovery_card.dart';

/// The Discovery swipe deck: drag-to-dismiss/like gesture, spring-back on a sub-threshold release, LIKE/NOPE stamp.
/// Performance: the drag offset lives in a [ValueNotifier] and the three visible cards are built ONCE per deck.
/// Extracted out of `discovery_screen.dart` (PRD Section 1.1) so the screen itself only owns the activity list + swipe.
class SwipeDeck extends StatefulWidget {
  const SwipeDeck({
    super.key,
    required this.activities,
    required this.topIndex,
    required this.onSwiped,
    this.onDragging,
    this.onPersistError,
  });

  final List<ActivityModel> activities;
  final int topIndex;
  final void Function(bool liked) onSwiped;

  /// Fires true when a drag starts, false when the drag (and any settle/exit animation it triggered) ends.
  final ValueChanged<bool>? onDragging;

  /// Invoked when persisting the swipe decision throws.
  final Future<void> Function()? onPersistError;

  @override
  State<SwipeDeck> createState() => _SwipeDeckState();
}

class _SwipeDeckState extends State<SwipeDeck> with TickerProviderStateMixin {
  /// Current drag offset. Updated directly from pointer events — no setState, so dragging never rebuilds this State.
  final ValueNotifier<Offset> _drag = ValueNotifier(Offset.zero);

  /// Exit fade (1 → 0 over the last third of the fling).
  double _exitFade = 1;

  bool _animating = false;
  bool _exiting = false;
  bool _thresholdReached = false;

  /// True while a spring-back or exit animation is running.
  bool get isBusy => _animating;

  // Prebuilt card widgets for the current deck position.
  Widget? _topCard;
  Widget? _nextCard;
  Widget? _afterNextCard;

  // Created eagerly in initState — not as lazy `late final` initializers.
  late AnimationController _springController;
  late AnimationController _exitController;
  late Animation<Offset> _exitAnimation;
  late Animation<double> _exitFadeAnimation;
  Offset _exitStart = Offset.zero;
  Offset _exitEnd = Offset.zero;

  @override
  void initState() {
    super.initState();
    _springController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 300),
    );
    _exitController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 280),
    );
    _rebuildCards();
  }

  @override
  void didUpdateWidget(covariant SwipeDeck oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.topIndex != widget.topIndex ||
        !identical(oldWidget.activities, widget.activities)) {
      _rebuildCards();
      _drag.value = Offset.zero;
      _exitFade = 1;
      _exiting = false;
      _thresholdReached = false;
    }
  }

  void _rebuildCards() {
    final items = widget.activities;
    // Guard: the parent may advance topIndex past the end (deck exhausted) before this State is swapped out.
    if (widget.topIndex < 0 || widget.topIndex >= items.length) {
      _topCard = null;
      _nextCard = null;
      _afterNextCard = null;
      return;
    }
    final top = items[widget.topIndex];
    // Background peeks render ONLY when a real next card exists.
    final next = widget.topIndex + 1 < items.length
        ? items[widget.topIndex + 1]
        : null;
    final afterNext = widget.topIndex + 2 < items.length
        ? items[widget.topIndex + 2]
        : null;
    _topCard = DiscoveryCard(activity: top);
    _nextCard = next == null ? null : DiscoveryCard(activity: next);
    _afterNextCard = afterNext == null
        ? null
        : DiscoveryCard(activity: afterNext);
    // Warm the image cache 3 cards ahead so the next swipe reveals a decoded photo.
    _precacheUpcoming(items, widget.topIndex);
  }

  /// Precache hero images for the next few deck positions.
  void _precacheUpcoming(List<ActivityModel> items, int topIndex) {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      final ctx = context;
      for (var i = topIndex + 1; i <= topIndex + 3 && i < items.length; i++) {
        final url = items[i].coverImageUrl;
        if (url == null || !isRemoteImage(url)) continue;
        precacheImage(CachedNetworkImageProvider(url), ctx).catchError((_) {});
      }
    });
  }

  @override
  void dispose() {
    _drag.dispose();
    _springController.dispose();
    _exitController.dispose();
    super.dispose();
  }

  void _onPanStart(DragStartDetails d) {
    if (_animating) return;
    widget.onDragging?.call(true);
  }

  void _onPanUpdate(DragUpdateDetails d) {
    if (_animating) return;
    // Horizontal only: vertical drift is locked so diagonal drags can't smuggle the card off-axis.
    _drag.value += Offset(d.delta.dx, 0);
    // Subtle tick when crossing the commit threshold.
    final threshold = _commitThreshold(context);
    final crossed = _drag.value.dx.abs() >= threshold;
    if (crossed && !_thresholdReached) {
      HapticFeedback.selectionClick();
      _thresholdReached = true;
    } else if (!crossed) {
      _thresholdReached = false;
    }
  }

  /// Commit distance: a quarter of the deck width, capped so large tablets don't demand an absurd throw.
  double _commitThreshold(BuildContext context) =>
      math.min(MediaQuery.of(context).size.width * 0.25, 160);

  void _onPanEnd(DragEndDetails d) {
    if (_animating) return;
    widget.onDragging?.call(false);
    final threshold = _commitThreshold(context);
    final dragDx = _drag.value.dx;
    final vx = d.velocity.pixelsPerSecond.dx;
    // A fast flick commits in the fling direction even with (near-)zero displacement.
    if (dragDx > threshold || vx > 700) {
      _animateOut(true, d.velocity.pixelsPerSecond);
    } else if (dragDx < -threshold || vx < -700) {
      _animateOut(false, d.velocity.pixelsPerSecond);
    } else {
      _springBack();
    }
  }

  Future<void> _springBack() async {
    final start = _drag.value;
    final tween = Tween<Offset>(begin: start, end: Offset.zero);
    final animation = tween.animate(
      CurvedAnimation(parent: _springController, curve: Curves.easeOutBack),
    );
    void listener() {
      _drag.value = animation.value;
    }

    _springController.addListener(listener);
    setState(() => _animating = true);
    _springController.value = 0;
    await _springController.forward();
    _springController.removeListener(listener);
    if (!mounted) return;
    _drag.value = Offset.zero;
    setState(() => _animating = false);
    widget.onDragging?.call(false);
  }

  Future<void> _animateOut(bool liked, Offset flingVelocity) async {
    _exitStart = _drag.value;
    final width = MediaQuery.of(context).size.width;
    final travelX = liked ? width * 1.4 : -width * 1.4;
    final exitVx = flingVelocity.dx.abs();
    final exitDurationMs = (280 - (exitVx.clamp(0, 1200) / 1200) * 100).round();
    _exitEnd = Offset(travelX, _drag.value.dy + 80);
    _exitController.duration = Duration(milliseconds: exitDurationMs);
    // Throw feel: accelerate off-screen (ease-in) instead of coasting out, and fade over the last third so the card.
    _exitAnimation = Tween<Offset>(begin: _exitStart, end: _exitEnd).animate(
      CurvedAnimation(parent: _exitController, curve: Curves.easeInCubic),
    );
    _exitFadeAnimation = Tween<double>(begin: 1, end: 0).animate(
      CurvedAnimation(parent: _exitController, curve: const Interval(0.65, 1)),
    );
    void listener() {
      _drag.value = _exitAnimation.value;
      _exitFade = _exitFadeAnimation.value;
    }

    _exitController.addListener(listener);
    setState(() {
      _animating = true;
      _exiting = true;
    });
    _exitController.value = 0;
    await _exitController.forward();
    _exitController.removeListener(listener);
    if (!mounted) return;
    _drag.value = Offset.zero;
    _exitFade = 1;
    setState(() {
      _animating = false;
      _exiting = false;
    });
    widget.onDragging?.call(false);
    widget.onSwiped(liked);
  }

  @override
  Widget build(BuildContext context) {
    // Guarded in [_rebuildCards]: an out-of-range topIndex.
    if (_topCard == null) return const SizedBox.shrink();
    // One AnimatedBuilder for the whole stack: pointer ticks update.
    return AnimatedBuilder(
      animation: _drag,
      builder: (context, _) {
        final dragX = _drag.value.dx;
        final absDrag = dragX.abs();
        final progress = (absDrag / 320).clamp(0.0, 1.0);
        // Extra spin while flying off so the exit reads as a throw.
        final rotation = dragX / (_exiting ? 700 : 1000);
        final likeOpacity = (dragX / 120).clamp(0.0, 1.0);
        final nopeOpacity = (-dragX / 120).clamp(0.0, 1.0);

        final nextScale = lerpDouble(0.95, 1.0, progress)!;
        final nextOpacity = lerpDouble(0.85, 1.0, progress)!;
        final nextOffset = lerpDouble(16.0, 0.0, progress)!;
        final afterScale = lerpDouble(0.88, 0.95, progress)!;
        final afterOpacity = lerpDouble(0.55, 0.85, progress)!;
        final afterOffset = lerpDouble(32.0, 16.0, progress)!;

        // Each card is sized to the full deck area.
        return LayoutBuilder(
          builder: (context, constraints) {
            final deckWidth = constraints.maxWidth;
            final deckHeight = constraints.maxHeight;
            SizedBox sized(Widget child) =>
                SizedBox(width: deckWidth, height: deckHeight, child: child);

            return Stack(
              alignment: Alignment.center,
              children: [
                if (_afterNextCard != null)
                  Transform.translate(
                    offset: Offset(0, afterOffset),
                    child: Transform.scale(
                      scale: afterScale,
                      child: Opacity(
                        opacity: afterOpacity,
                        child: sized(_afterNextCard!),
                      ),
                    ),
                  ),
                if (_nextCard != null)
                  Transform.translate(
                    offset: Offset(0, nextOffset),
                    child: Transform.scale(
                      scale: nextScale,
                      child: Opacity(
                        opacity: nextOpacity,
                        child: sized(_nextCard!),
                      ),
                    ),
                  ),
                Semantics(
                  label:
                      'Activity card. Swipe right to like, left to pass. '
                      'Use the action buttons below as an alternative to swiping.',
                  child: GestureDetector(
                    onPanStart: _onPanStart,
                    onPanUpdate: _onPanUpdate,
                    onPanEnd: _onPanEnd,
                    child: Transform.translate(
                      offset: _drag.value,
                      child: Transform.rotate(
                        angle: rotation,
                        child: Opacity(
                          opacity: _exitFade,
                          child: sized(
                            Stack(
                              fit: StackFit.expand,
                              children: [
                                _topCard!,
                                if (likeOpacity > 0)
                                  Positioned(
                                    top: 28,
                                    left: 28,
                                    child: Opacity(
                                      opacity: likeOpacity,
                                      child: const _StampBadge(
                                        label: 'LIKE',
                                        color: AppColors.likeGreen,
                                        rotation: -0.2,
                                      ),
                                    ),
                                  ),
                                if (nopeOpacity > 0)
                                  Positioned(
                                    top: 28,
                                    right: 28,
                                    child: Opacity(
                                      opacity: nopeOpacity,
                                      child: const _StampBadge(
                                        label: 'NOPE',
                                        color: AppColors.nopeRed,
                                        rotation: 0.2,
                                      ),
                                    ),
                                  ),
                              ],
                            ),
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
              ],
            );
          },
        );
      },
    );
  }
}

class _StampBadge extends StatelessWidget {
  const _StampBadge({
    required this.label,
    required this.color,
    required this.rotation,
  });

  final String label;
  final Color color;
  final double rotation;

  @override
  Widget build(BuildContext context) {
    return Transform.rotate(
      angle: rotation,
      child: Container(
        padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.x3 + 2,
          vertical: AppSpacing.x2,
        ),
        decoration: BoxDecoration(
          border: Border.all(color: color, width: 4),
          borderRadius: AppRadius.xsR,
          color: context.colors.surface.withValues(alpha: 0.9),
        ),
        child: Text(
          label,
          style: AppTypography.headlineSmall(context).copyWith(
            color: color,
            fontWeight: FontWeight.w900,
            fontSize: 28,
            letterSpacing: 2,
          ),
        ),
      ),
    );
  }
}
