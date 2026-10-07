import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_spacing.dart';
import '../../../core/theme/dark_colors.dart';
import '../domain/tour_state.dart';
import '../domain/tour_step.dart';
import 'tour_anchors.dart';
import 'tour_controller.dart';
import 'tour_steps.dart';
import 'widgets/spotlight_overlay.dart';
import 'widgets/tour_callout_card.dart';

/// Mounts a coach-mark overlay above [child] whenever [tourControllerProvider] has an active tour.
/// This widget owns the `OverlayEntry` lifecycle.
class TourHost extends ConsumerStatefulWidget {
  const TourHost({super.key, required this.child, required this.location});

  final Widget child;

  /// The shell's current `matchedLocation` (from `AppShell`).
  final String location;

  @override
  ConsumerState<TourHost> createState() => _TourHostState();
}

class _TourHostState extends ConsumerState<TourHost> {
  OverlayEntry? _entry;

  /// True once the deferred insert actually ran.
  bool _inserted = false;

  bool get _isOnTourScreen => widget.location.startsWith('/discovery');

  @override
  void initState() {
    super.initState();
    // The tour is armed on get-to-know-3, one screen before this widget even exists.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) {
        _sync(
          ref.read(tourControllerProvider),
          ref.read(discoveryContentReadyProvider),
        );
      }
    });
  }

  @override
  void didUpdateWidget(TourHost oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.location != widget.location) {
      _sync(
        ref.read(tourControllerProvider),
        ref.read(discoveryContentReadyProvider),
      );
    }
  }

  @override
  void dispose() {
    _removeEntry();
    super.dispose();
  }

  /// Single decision point for whether the overlay should be mounted right now: the tour must be active AND the user.
  void _sync(TourState state, bool contentReady) {
    // First-run arm (set by get-to-know-3): start the tour the first time Discovery is actually showing with content.
    if (_isOnTourScreen && contentReady && !state.isActive) {
      final controller = ref.read(tourControllerProvider.notifier);
      if (controller.consumeFirstRunArm()) {
        controller.maybeStart(kFirstRunTourId, kFirstRunTour);
      }
    }
    final shouldShow =
        ref.read(tourControllerProvider).isActive &&
        _isOnTourScreen &&
        contentReady;
    if (shouldShow && _entry == null) {
      _insertEntry();
    } else if (!shouldShow && _entry != null) {
      _removeEntry();
    }
  }

  void _insertEntry() {
    if (_entry != null) return;
    // `captureAll` snapshots every InheritedWidget from the current context.
    final capturedThemes = InheritedTheme.captureAll(
      context,
      const _TourOverlayContent(),
    );
    final entry = OverlayEntry(builder: (_) => capturedThemes);
    _entry = entry;

    // Defer the actual insert to after this frame.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted || _entry != entry) return;
      Overlay.of(context).insert(entry);
      _inserted = true;
    });
  }

  void _removeEntry() {
    final entry = _entry;
    _entry = null;
    // Never inserted (instant skip before the deferred insert ran, or the post-frame guard already bailed).
    if (entry == null || !_inserted) return;
    _inserted = false;
    entry.remove();
  }

  @override
  Widget build(BuildContext context) {
    // A tour starting/ending, content becoming ready, or the location changing only ever flips whether the overlay.
    ref.listen<TourState>(tourControllerProvider, (previous, next) {
      _sync(next, ref.read(discoveryContentReadyProvider));
    });
    ref.listen<bool>(discoveryContentReadyProvider, (previous, next) {
      _sync(ref.read(tourControllerProvider), next);
    });

    // Only rebuild this PopScope when isActive itself flips, not on every step index change.
    final isActive = ref.watch(
      tourControllerProvider.select((s) => s.isActive),
    );
    final contentReady = ref.watch(discoveryContentReadyProvider);

    // Gate the back-button intercept on the overlay actually being visible — not merely on the tour being active.
    final overlayVisible = isActive && _isOnTourScreen && contentReady;

    // PopScope must live in TourHost's own build().
    return PopScope(
      canPop: !overlayVisible,
      onPopInvokedWithResult: (didPop, _) {
        if (didPop) return;
        ref.read(tourControllerProvider.notifier).skip();
      },
      child: widget.child,
    );
  }
}

/// The actual overlay content: watches [tourControllerProvider] directly.
class _TourOverlayContent extends ConsumerWidget {
  const _TourOverlayContent();

  Rect? _resolveAnchorRect(TourAnchorId anchorId, double padding) {
    final key = TourAnchors.keyFor(anchorId);
    if (key == null) return null;

    final renderObject = key.currentContext?.findRenderObject();
    if (renderObject is! RenderBox || !renderObject.attached) return null;

    final topLeft = renderObject.localToGlobal(Offset.zero);
    final rect = Rect.fromLTWH(
      topLeft.dx,
      topLeft.dy,
      renderObject.size.width,
      renderObject.size.height,
    );
    return rect.inflate(padding);
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final tourState = ref.watch(tourControllerProvider);
    final step = tourState.current;
    final controller = ref.read(tourControllerProvider.notifier);

    // Nothing to show — either idle, or (defensively) an out-of-range index.
    if (step == null) return const SizedBox.shrink();

    // Registering a MediaQuery dependency here means THIS widget rebuilds on rotation too.
    MediaQuery.of(context);

    final holeRect = _resolveAnchorRect(step.anchor, step.padding);

    // A step with a real anchor (not the centered "welcome" step) whose anchor fails to resolve means the widget it.
    if (step.anchor != TourAnchorId.none && holeRect == null) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        controller.skipUnavailableStep();
      });
      return const SizedBox.shrink();
    }

    // Dark-mode scrim: the legacy light scrim reads as washed-out grey over a dark feed.
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final skipped = controller.skippedTitles;

    return SpotlightOverlay(
      holeRect: holeRect,
      shape: step.shape,
      holeRadius: AppRadius.card,
      onTapScrim: controller.skip,
      scrimColor: isDark ? context.colors.scrim : null,
      child: Material(
        type: MaterialType.transparency,
        child: TourCalloutCard(
          title: step.title,
          body: step.body,
          currentStep: tourState.index + 1,
          totalSteps: tourState.steps.length,
          isLastStep: tourState.isLast,
          onSkip: controller.skip,
          onNext: controller.next,
          onBack: tourState.index > 0 ? controller.back : null,
          footnote: tourState.isLast && skipped.isNotEmpty
              ? 'Skipped ${skipped.length} unavailable '
                    '${skipped.length == 1 ? 'tip' : 'tips'}'
              : null,
        ),
      ),
    );
  }
}
