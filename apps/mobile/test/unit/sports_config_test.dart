import 'package:flutter_test/flutter_test.dart';
import 'package:matchup_mobile/features/sports/domain/sport_config.dart';

const _tennis = SportConfig(
  id: 'tennis',
  name: 'Tennis',
  emoji: '🎾',
  showInFilter: true,
  showInOnboarding: true,
  canHost: true,
  sortOrder: 1,
);

const _golf = SportConfig(
  id: 'golf',
  name: 'Golf',
  emoji: '⛳',
  showInFilter: true,
  showInOnboarding: true,
  canHost: false,
  sortOrder: 2,
);

void main() {
  group('SportConfig.fromJson', () {
    test('parses the public-sports view', () {
      final c = SportConfig.fromJson({
        'id': 'tennis',
        'name': 'Tennis',
        'emoji': '🎾',
        'showInFilter': true,
        'showInOnboarding': true,
        'canHost': true,
        'sortOrder': 1,
      });
      expect(c.name, 'Tennis');
      expect(c.canHost, isTrue);
    });

    test('missing flags default to false, order to 999', () {
      const c = SportConfig(
        id: 'x',
        name: 'X',
        emoji: '',
        showInFilter: false,
        showInOnboarding: false,
        canHost: false,
        sortOrder: 999,
      );
      final parsed = SportConfig.fromJson({'id': 'x', 'name': 'X'});
      expect(parsed, isA<SportConfig>());
      expect(parsed.canHost, isFalse);
      expect(parsed.sortOrder, 999);
      expect(c.sortOrder, 999);
    });
  });

  group('pickSportNames', () {
    const fallback = ['Fallback'];

    test('selects per surface', () {
      expect(pickSportNames([_tennis, _golf], (s) => s.canHost, fallback), [
        'Tennis',
      ]);
      expect(
        pickSportNames([_tennis, _golf], (s) => s.showInFilter, fallback),
        ['Tennis', 'Golf'],
      );
    });

    test('falls back on empty configs or empty selection', () {
      expect(pickSportNames([], (s) => true, fallback), fallback);
      expect(pickSportNames([_golf], (s) => s.canHost, fallback), fallback);
    });
  });
}
