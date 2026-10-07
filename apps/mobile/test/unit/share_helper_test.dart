import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:matchup_mobile/core/utils/geo.dart';
import 'package:matchup_mobile/core/utils/share_helper.dart';

void main() {
  group('distanceLabel', () {
    test('formats positive distances', () {
      expect(distanceLabel(1.24), '1.2 km away');
    });

    test('returns null for zero/negative (unknown, not here)', () {
      expect(distanceLabel(0), isNull);
      expect(distanceLabel(-3), isNull);
    });
  });

  group('ShareHelper.shareText', () {
    testWidgets('returns true when the platform handles it', (tester) async {
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(
            const MethodChannel('dev.fluttercommunity.plus/share'),
            (call) async => 'success',
          );
      addTearDown(
        () => TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
            .setMockMethodCallHandler(
              const MethodChannel('dev.fluttercommunity.plus/share'),
              null,
            ),
      );
      expect(await ShareHelper.shareText('hello'), isTrue);
    });

    test('distanceLabel edge: tiny positive still shows', () {
      expect(distanceLabel(0.04), '0.0 km away');
    });
  });
}
