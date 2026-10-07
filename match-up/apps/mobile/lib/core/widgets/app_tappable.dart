import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../theme/app_spacing.dart';

/// Feedback style for [AppTappable].
enum AppTapFeedback {
  /// Material ripple via [InkWell].
  ripple,

  /// Scale-down-on-press via [AnimatedScale].
  scale,
}

/// Wraps any child with real press feedback and a guaranteed minimum hit area, without changing its visual size.
/// Before this widget, most tappable surfaces in the app were bare `GestureDetector`s.
/// The 44x44 minimum hit area (Apple HIG / Material guidance) is enforced via SizedBox + Center.
/// dart AppTappable( onTap: _toggleFavorite, semanticLabel: 'Add to favorites', feedback: AppTapFeedback.scale.
class AppTappable extends StatefulWidget {
  const AppTappable({
    super.key,
    required this.child,
    required this.semanticLabel,
    this.onTap,
    this.feedback = AppTapFeedback.ripple,
    this.minSize = 44,
    this.borderRadius,
    this.enabled = true,
    this.haptic = true,
  });

  final Widget child;

  /// Required — every tappable surface must be identifiable to a screen reader.
  final String semanticLabel;

  final VoidCallback? onTap;
  final AppTapFeedback feedback;

  /// Minimum hit area edge length. Defaults to the 44pt accessibility floor; only raise it, never lower it.
  final double minSize;

  /// [AppTapFeedback.ripple] only — clip/ripple radius.
  final double? borderRadius;

  final bool enabled;

  /// Light haptic tap on press, matching the rest of the app's buttons.
  final bool haptic;

  @override
  State<AppTappable> createState() => _AppTappableState();
}

class _AppTappableState extends State<AppTappable> {
  bool _pressed = false;

  bool get _interactive => widget.enabled && widget.onTap != null;

  void _handleTap() {
    if (!_interactive) return;
    if (widget.haptic) HapticFeedback.lightImpact();
    widget.onTap!();
  }

  @override
  Widget build(BuildContext context) {
    // Stack (not SizedBox+Center): a SizedBox forces its child's layout box to exactly minSize.
    final sized = Stack(
      alignment: Alignment.center,
      children: [
        SizedBox(width: widget.minSize, height: widget.minSize),
        widget.child,
      ],
    );

    final content = widget.feedback == AppTapFeedback.ripple
        ? Material(
            type: MaterialType.transparency,
            child: InkWell(
              onTap: _interactive ? _handleTap : null,
              borderRadius: BorderRadius.circular(
                widget.borderRadius ?? AppRadius.md,
              ),
              child: sized,
            ),
          )
        : GestureDetector(
            onTap: _interactive ? _handleTap : null,
            onTapDown: _interactive
                ? (_) => setState(() => _pressed = true)
                : null,
            onTapUp: _interactive
                ? (_) => setState(() => _pressed = false)
                : null,
            onTapCancel: _interactive
                ? () => setState(() => _pressed = false)
                : null,
            behavior: HitTestBehavior.opaque,
            child: AnimatedScale(
              scale: _pressed ? 0.97 : 1.0,
              duration: AppDurations.fast,
              curve: Curves.easeOut,
              child: sized,
            ),
          );

    return Semantics(
      button: true,
      label: widget.semanticLabel,
      enabled: _interactive,
      child: Opacity(opacity: widget.enabled ? 1.0 : 0.5, child: content),
    );
  }
}
