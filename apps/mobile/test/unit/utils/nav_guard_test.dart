import 'package:flutter_test/flutter_test.dart';

import 'package:matchup_mobile/core/utils/nav_guard.dart';

/// The duplicate-page crash this guards against
/// ('!keyReservation.contains(key)' → broken navigator → blank screen)
/// is a cross-frame race that widget tests can't reproduce deterministically
/// (awaits flush the navigator between gestures). These tests pin the
/// debounce mechanism itself: same key blocked, different keys pass,
// expiry releases.
void main() {
  setUp(NavGuard.resetForTest);

  test('onceFor runs the first call and drops an immediate repeat', () {
    var runs = 0;
    NavGuard.onceFor('activity-details-1', () => runs++);
    NavGuard.onceFor('activity-details-1', () => runs++);
    expect(runs, 1);
  });

  test('onceFor lets different keys through independently', () {
    var runs = 0;
    NavGuard.onceFor('activity-details-1', () => runs++);
    NavGuard.onceFor('activity-details-2', () => runs++);
    expect(runs, 2);
  });

  test('onceFor releases the key after the cooldown', () async {
    var runs = 0;
    const window = Duration(milliseconds: 5);
    NavGuard.onceFor('activity-details-1', () => runs++, cooldown: window);
    NavGuard.onceFor('activity-details-1', () => runs++, cooldown: window);
    expect(runs, 1);
    await Future<void>.delayed(window + const Duration(milliseconds: 10));
    NavGuard.onceFor('activity-details-1', () => runs++, cooldown: window);
    expect(runs, 2);
  });

  test('once blocks while busy and releases after cooldown', () async {
    var runs = 0;
    const window = Duration(milliseconds: 5);
    NavGuard.once(() => runs++, cooldown: window);
    NavGuard.once(() => runs++, cooldown: window);
    expect(runs, 1);
    await Future<void>.delayed(window + const Duration(milliseconds: 10));
    NavGuard.once(() => runs++, cooldown: window);
    expect(runs, 2);
  });
}
