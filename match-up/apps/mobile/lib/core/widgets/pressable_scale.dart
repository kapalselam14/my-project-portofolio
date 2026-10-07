import 'package:flutter/material.dart';

import '../theme/app_spacing.dart';

/// Minimal scale-down-on-press wrapper for bare tap targets that can't easily adopt [AppTappable].
/// Mirrors the exact scale feedback used by `AppTappable`'s `AppTapFeedback.scale` mode.
/// ```dart PressableScale( onTap: _handleTap, child: ExistingChildTree(...), ) ```.
class PressableScale extends StatefulWidget {
  const PressableScale({
    super.key,
    required this.child,
    this.onTap,
    this.behavior = HitTestBehavior.opaque,
  });

  final Widget child;
  final VoidCallback? onTap;
  final HitTestBehavior behavior;

  @override
  State<PressableScale> createState() => _PressableScaleState();
}

class _PressableScaleState extends State<PressableScale> {
  bool _pressed = false;

  bool get _interactive => widget.onTap != null;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: widget.onTap,
      onTapDown: _interactive ? (_) => setState(() => _pressed = true) : null,
      onTapUp: _interactive ? (_) => setState(() => _pressed = false) : null,
      onTapCancel: _interactive ? () => setState(() => _pressed = false) : null,
      behavior: widget.behavior,
      child: AnimatedScale(
        scale: _pressed ? 0.97 : 1.0,
        duration: AppDurations.fast,
        curve: Curves.easeOut,
        child: widget.child,
      ),
    );
  }
}
