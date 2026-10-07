import 'package:flutter_test/flutter_test.dart';
import 'package:matchup_mobile/core/utils/geo.dart';

void main() {
  group('haversineKm', () {
    test('returns 0 for identical points', () {
      expect(haversineKm(-36.8485, 174.7633, -36.8485, 174.7633), 0.0);
    });

    test('Auckland CBD to Eden Park is roughly 3.5 km', () {
      // Auckland CBD (-36.8485, 174.7633) → Eden Park (-36.8750, 174.7450).
      final d = haversineKm(-36.8485, 174.7633, -36.8750, 174.7450);
      expect(d, greaterThan(3.0));
      expect(d, lessThan(4.0));
    });

    test('is symmetric', () {
      final a = haversineKm(-36.86, 174.77, -36.90, 174.82);
      final b = haversineKm(-36.90, 174.82, -36.86, 174.77);
      expect(a, closeTo(b, 1e-9));
    });
  });
}
