import 'package:flutter/material.dart';

/// System-back fallback for screens that can be the last page on the stack (opened via `context.go`, deep links.
/// Usage: wrap the screen's scaffold.
/// ```dart SystemBackFallback( onEmptyStack: (context) => context.go('/discovery'), child: AppScaffold(...), ) ```.
class SystemBackFallback extends StatelessWidget {
  const SystemBackFallback({
    super.key,
    required this.onEmptyStack,
    required this.child,
  });

  /// Called with a [BuildContext] when the system back button finds no route to pop.
  final void Function(BuildContext context) onEmptyStack;

  final Widget child;

  /// Last handled back-press (app-wide).
  static DateTime? _lastHandled;
  static const _debounceWindow = Duration(milliseconds: 500);

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: true,
      onPopInvokedWithResult: (didPop, _) {
        if (didPop) return;
        final age = DateTime.now().difference(
          _lastHandled ?? DateTime.fromMillisecondsSinceEpoch(0),
        );
        // Negative age (clock skew) counts as stale, never as "too soon".
        if (!age.isNegative && age < _debounceWindow) return;
        _lastHandled = DateTime.now();
        onEmptyStack(context);
      },
      child: child,
    );
  }
}
