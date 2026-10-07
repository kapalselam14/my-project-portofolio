import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:matchup_mobile/features/tour/data/prefs_tour_store.dart';
import 'package:matchup_mobile/features/tour/data/tour_store.dart';
import 'package:matchup_mobile/features/tour/domain/tour_step.dart';
import 'package:matchup_mobile/features/tour/presentation/tour_controller.dart';

class _FailingTourStore implements TourStore {
  @override
  Future<bool> hasSeen(String tourId) async => false;

  @override
  Future<void> markSeen(String tourId) async {
    throw StateError('disk full');
  }

  @override
  Future<void> reset(String tourId) async {}
}

void main() {
  const tourId = 'first_run';
  const steps = [
    TourStep(anchor: TourAnchorId.none, title: 'Step 1', body: 'Body 1'),
    TourStep(anchor: TourAnchorId.swipeDeck, title: 'Step 2', body: 'Body 2'),
    TourStep(anchor: TourAnchorId.actionRow, title: 'Step 3', body: 'Body 3'),
  ];

  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  TourController buildController() => TourController(PrefsTourStore());

  group('maybeStart', () {
    test('should start the tour when it has never been seen', () async {
      final controller = buildController();

      await controller.maybeStart(tourId, steps);

      expect(controller.state.isActive, isTrue);
      expect(controller.state.index, 0);
      expect(controller.state.current?.title, 'Step 1');
    });

    test('should not start the tour when it was already marked seen', () async {
      final store = PrefsTourStore();
      await store.markSeen(tourId);
      final controller = TourController(store);

      await controller.maybeStart(tourId, steps);

      expect(controller.state.isActive, isFalse);
    });

    test('should be idempotent when a tour is already active', () async {
      final controller = buildController();
      await controller.maybeStart(tourId, steps);
      controller.next(); // move to index 1

      await controller.maybeStart(tourId, steps);

      // Second call must not reset progress back to index 0.
      expect(controller.state.index, 1);
    });
  });

  group('next / back', () {
    test('should advance through steps in order', () {
      final controller = buildController();
      controller.start(tourId, steps);

      controller.next();

      expect(controller.state.index, 1);
      expect(controller.state.current?.title, 'Step 2');
    });

    test(
      'should complete the tour when next is called on the last step',
      () async {
        final controller = buildController();
        controller.start(tourId, steps);
        controller.next(); // index 1
        controller.next(); // index 2 (last)

        controller.next(); // should complete, not overflow
        // complete() persists the seen flag BEFORE going idle — allow the
        // async write to land.
        await Future<void>.delayed(Duration.zero);

        expect(controller.state.isActive, isFalse);
      },
    );

    test('should do nothing when back is called on the first step', () {
      final controller = buildController();
      controller.start(tourId, steps);

      controller.back();

      expect(controller.state.index, 0);
      expect(controller.state.isActive, isTrue);
    });

    test('should move to the previous step when back is called mid-tour', () {
      final controller = buildController();
      controller.start(tourId, steps);
      controller.next(); // index 1

      controller.back();

      expect(controller.state.index, 0);
    });
  });

  group('skip / complete', () {
    test('should mark the tour as seen exactly once when skipped', () async {
      final store = PrefsTourStore();
      final controller = TourController(store);
      controller.start(tourId, steps);

      await controller.skip();

      expect(await store.hasSeen(tourId), isTrue);
      expect(controller.state.isActive, isFalse);
    });

    test('should mark the tour as seen when completed via next()', () async {
      final store = PrefsTourStore();
      final controller = TourController(store);
      controller.start(tourId, steps);
      controller.next();
      controller.next();
      controller.next(); // last step → auto-completes (fire-and-forget)

      // next() is intentionally synchronous (void) so UI taps never await —
      // the persistence write it triggers finishes on a later microtask.
      await Future<void>.delayed(Duration.zero);

      expect(await store.hasSeen(tourId), isTrue);
    });

    test('should leave state idle and re-runnable after completion', () async {
      final controller = buildController();
      controller.start(tourId, steps);
      await controller.complete();

      expect(controller.state.isActive, isFalse);
      expect(controller.state.steps, isEmpty);
    });

    test(
      'should stay active and report false when persistence fails',
      () async {
        final controller = TourController(_FailingTourStore());
        controller.start(tourId, steps);

        final ok = await controller.complete();

        expect(ok, isFalse);
        expect(controller.state.isActive, isTrue);
      },
    );
  });

  group('start (replay)', () {
    test('should start unconditionally even if already marked seen', () async {
      final store = PrefsTourStore();
      await store.markSeen(tourId);
      final controller = TourController(store);

      controller.start(tourId, steps);

      expect(controller.state.isActive, isTrue);
      expect(controller.state.index, 0);
    });

    test('should do nothing when given an empty step list', () {
      final controller = buildController();

      controller.start(tourId, const []);

      expect(controller.state.isActive, isFalse);
    });
  });

  group('TourState', () {
    test('should report progress as (index + 1) / total', () {
      final controller = buildController();
      controller.start(tourId, steps);
      controller.next();

      expect(controller.state.progress, closeTo(2 / 3, 0.001));
    });

    test('should report isLast only on the final step', () {
      final controller = buildController();
      controller.start(tourId, steps);

      expect(controller.state.isLast, isFalse);

      controller.next();
      controller.next();

      expect(controller.state.isLast, isTrue);
    });
  });
}
