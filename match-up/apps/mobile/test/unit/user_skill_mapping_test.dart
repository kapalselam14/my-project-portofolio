import 'package:flutter_test/flutter_test.dart';
import 'package:matchup_mobile/features/profile/data/user_repository_impl.dart';

void main() {
  group('wireSkillLevel', () {
    test('normalises UI labels to backend wire values', () {
      expect(wireSkillLevel('Beginner'), 'beginner');
      expect(wireSkillLevel('Intermediate'), 'intermediate');
      expect(wireSkillLevel('Advanced'), 'advanced');
    });

    test('is case-insensitive and trims', () {
      expect(wireSkillLevel('  INTERMEDIATE '), 'intermediate');
    });

    test('returns null for missing or unknown levels', () {
      expect(wireSkillLevel(''), isNull);
      expect(wireSkillLevel('Expert'), isNull);
    });
  });

  group('dominantSkillLevel', () {
    test('picks the most frequent level', () {
      expect(
        dominantSkillLevel(const [
          (sport: 'Tennis', level: 'Intermediate'),
          (sport: 'Basketball', level: 'Beginner'),
          (sport: 'Soccer', level: 'Intermediate'),
        ]),
        'intermediate',
      );
    });

    test('ties resolve to the first-seen level', () {
      expect(
        dominantSkillLevel(const [
          (sport: 'Tennis', level: 'Beginner'),
          (sport: 'Basketball', level: 'Intermediate'),
        ]),
        'beginner',
      );
    });

    test('ignores sports without a usable level', () {
      expect(
        dominantSkillLevel(const [
          (sport: 'Tennis', level: ''),
          (sport: 'Basketball', level: 'Advanced'),
        ]),
        'advanced',
      );
    });

    test('returns null when nothing usable remains', () {
      expect(dominantSkillLevel(const []), isNull);
      expect(dominantSkillLevel(const [(sport: 'Tennis', level: '')]), isNull);
    });
  });

  group('labelSkillLevel', () {
    test('maps wire values back to UI labels', () {
      expect(labelSkillLevel('beginner'), 'Beginner');
      expect(labelSkillLevel('intermediate'), 'Intermediate');
      expect(labelSkillLevel('advanced'), 'Advanced');
    });

    test('falls back to Intermediate for unknown input', () {
      expect(labelSkillLevel(null), 'Intermediate');
      expect(labelSkillLevel(''), 'Intermediate');
      expect(labelSkillLevel('expert'), 'Intermediate');
    });
  });
}
