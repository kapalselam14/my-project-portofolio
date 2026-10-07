import 'dart:async';

import 'package:flutter_test/flutter_test.dart';

import 'package:matchup_mobile/core/utils/stream_timeout.dart';

void main() {
  group('withFirstEventTimeout', () {
    test('forwards every event of a healthy stream', () async {
      final source = Stream<int>.fromIterable([1, 2, 3]);
      final out = await withFirstEventTimeout(
        source,
        timeout: const Duration(milliseconds: 50),
      ).toList();
      expect(out, [1, 2, 3]);
    });

    test('throws TimeoutException when the first event stalls', () async {
      final controller = StreamController<int>();
      addTearDown(controller.close);
      expect(
        () => withFirstEventTimeout(
          controller.stream,
          timeout: const Duration(milliseconds: 50),
        ).toList(),
        throwsA(isA<TimeoutException>()),
      );
    });

    test('does not time out idle gaps after the first event', () async {
      final controller = StreamController<int>();
      addTearDown(controller.close);
      final collected = <int>[];
      final done = withFirstEventTimeout(
        controller.stream,
        timeout: const Duration(milliseconds: 50),
      ).listen(collected.add);
      addTearDown(done.cancel);

      controller.add(1);
      // Second event arrives well past the first-event timeout.
      await Future<void>.delayed(const Duration(milliseconds: 150));
      controller.add(2);
      await Future<void>.delayed(const Duration(milliseconds: 50));

      expect(collected, [1, 2]);
    });

    test('propagates source errors instead of hanging', () async {
      final source = Stream<int>.error(StateError('denied'));
      expect(
        () => withFirstEventTimeout(
          source,
          timeout: const Duration(milliseconds: 50),
        ).toList(),
        throwsStateError,
      );
    });
  });
}
