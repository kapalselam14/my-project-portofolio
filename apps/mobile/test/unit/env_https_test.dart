import 'package:flutter_test/flutter_test.dart';
import 'package:matchup_mobile/core/config/env.dart';

void main() {
  group('Env.assertHttpsOutsideLocal', () {
    test('allows anything in local', () {
      expect(
        () => Env.assertHttpsOutsideLocal('http://localhost:4000', 'local'),
        returnsNormally,
      );
      expect(
        () => Env.assertHttpsOutsideLocal('http://192.168.1.5:4000', 'local'),
        returnsNormally,
      );
    });

    test('requires https outside local', () {
      expect(
        () => Env.assertHttpsOutsideLocal('https://api.matchup.app', 'staging'),
        returnsNormally,
      );
      expect(
        () => Env.assertHttpsOutsideLocal(
          'https://api.matchup.app',
          'production',
        ),
        returnsNormally,
      );
      expect(
        () => Env.assertHttpsOutsideLocal('http://api.matchup.app', 'staging'),
        throwsStateError,
      );
      expect(
        () => Env.assertHttpsOutsideLocal('http://10.0.2.2:4000', 'production'),
        throwsStateError,
      );
    });
  });
}
