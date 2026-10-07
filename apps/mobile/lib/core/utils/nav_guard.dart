import 'dart:async';

import 'package:clock/clock.dart';
import 'package:flutter/widgets.dart';
import 'package:go_router/go_router.dart';

/// Prevents the same navigation action from firing twice in quick succession.
/// A duplicate `context.push(path)` before the first push has been processed creates two.
/// ```dart PressableScale( onTap: () => NavGuard.once(() => context.push('/some/$id')), child: ..., ) ```.
/// Report Activity was migrated off this helper: it's now a modal sheet (`ReportActivitySheet.show`).
class NavGuard {
  NavGuard._();

  static bool _busy = false;

  /// Per-key last-run timestamps so independent actions.
  static final Map<String, DateTime> _lastRun = {};

  /// Runs [action] only if no other guarded action is currently in flight.
  static void once(void Function() action, {Duration? cooldown}) {
    if (_busy) return;
    _busy = true;
    action();
    Timer(cooldown ?? const Duration(milliseconds: 600), () {
      _busy = false;
    });
  }

  /// Per-key variant of [once]: debounces rapid repeats of the same [key] within [cooldown].
  /// dart PressableScale( onTap: () => NavGuard.onceFor( 'gtk-1-next', () => context.push('/get-to-know-2'), ).
  /// NOTE: [onceFor] only covers taps within [cooldown].
  static void onceFor(
    String key,
    void Function() action, {
    Duration? cooldown,
  }) {
    final now = DateTime.now();
    final last = _lastRun[key];
    final window = cooldown ?? const Duration(milliseconds: 600);
    if (last != null && now.difference(last) < window) return;
    _lastRun[key] = now;
    action();
  }

  @visibleForTesting
  static void resetForTest() {
    _busy = false;
    _lastRun.clear();
    _inFlightSince.clear();
  }

  /// Safety-net window for [push]/[pushT]/[pushOnce].
  /// That Future only resolves on a genuine pop.
  /// Checked lazily on the next [_isStuck] call rather than via a scheduled `Timer`.
  static const Duration _pushSafetyNet = Duration(seconds: 5);

  /// In-flight pushes by key, timestamped when reserved.
  static final Map<String, DateTime> _inFlightSince = {};

  static bool _isStuck(String key) {
    final since = _inFlightSince[key];
    if (since == null) return false;
    if (clock.now().difference(since) > _pushSafetyNet) {
      _inFlightSince.remove(key);
      return false;
    }
    return true;
  }

  /// Pushes [location] once per location: repeat taps for the same destination while its page is still on the stack.
  static Future<void> push(
    BuildContext context,
    String location, {
    Object? extra,
  }) async {
    if (_isStuck(location)) return;
    _inFlightSince[location] = clock.now();
    final release = _watchForLeave(context, location, location);
    try {
      await context.push(location, extra: extra);
    } finally {
      release();
      _inFlightSince.remove(location);
    }
  }

  /// Watches the router and releases [key] as soon as the pushed.
  static VoidCallback _watchForLeave(
    BuildContext context,
    String key,
    String location,
  ) {
    final router = GoRouter.of(context);
    var seen = false;
    var done = false;
    void listener() {
      if (done) return;
      // First ticks still point at the pushed page.
      if (router.state.uri.path == location) {
        seen = true;
        return;
      }
      if (seen) {
        done = true;
        _inFlightSince.remove(key);
        router.routerDelegate.removeListener(listener);
      }
    }

    router.routerDelegate.addListener(listener);
    return () {
      if (done) return;
      done = true;
      router.routerDelegate.removeListener(listener);
    };
  }

  /// Typed variant of [push] for callers that await a pop result.
  static Future<T?> pushT<T>(
    BuildContext context,
    String location, {
    Object? extra,
  }) async {
    if (_isStuck(location)) return null;
    _inFlightSince[location] = clock.now();
    final release = _watchForLeave(context, location, location);
    try {
      return await context.push<T>(location, extra: extra);
    } finally {
      release();
      _inFlightSince.remove(location);
    }
  }

  /// Pushes [location] once: repeat taps while the route is still on the stack are ignored.
  static Future<void> pushOnce(
    BuildContext context,
    String key,
    String location, {
    Object? extra,
  }) async {
    if (_isStuck(key)) return;
    _inFlightSince[key] = clock.now();
    final release = _watchForLeave(context, key, location);
    try {
      await context.push(location, extra: extra);
    } finally {
      release();
      _inFlightSince.remove(key);
    }
  }
}
