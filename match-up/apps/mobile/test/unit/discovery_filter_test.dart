import 'package:flutter_test/flutter_test.dart';
import 'package:matchup_mobile/features/discovery/domain/discovery_filter.dart';

void main() {
  group('DiscoveryFilter', () {
    test('isEmpty when nothing is set', () {
      const f = DiscoveryFilter();
      expect(f.isEmpty, isTrue);
    });

    test('isEmpty when sportSkills set, even with all-any', () {
      const f = DiscoveryFilter(
        sportSkills: [
          DiscoverySportSkill(
            sport: 'Basketball',
            skill: DiscoverySkillLevel.any,
          ),
        ],
      );
      expect(f.isEmpty, isFalse);
    });

    test('sportFiltersQueryParam joins Sport:skill with commas', () {
      const f = DiscoveryFilter(
        sportSkills: [
          DiscoverySportSkill(
            sport: 'Basketball',
            skill: DiscoverySkillLevel.intermediate,
          ),
          DiscoverySportSkill(
            sport: 'Tennis',
            skill: DiscoverySkillLevel.advanced,
          ),
        ],
      );
      expect(
        f.sportFiltersQueryParam,
        'Basketball:intermediate,Tennis:advanced',
      );
    });

    test('dateRange for today is 24h window in ISO', () {
      const f = DiscoveryFilter(datePreset: DiscoveryDatePreset.today);
      final range = f.dateRange;
      expect(range.startAfter, isNotNull);
      expect(
        range.startAfter!.endsWith('Z') || range.startAfter!.contains('+'),
        isTrue,
      );
      expect(range.startBefore, isNotNull);
    });

    test('today window covers the local calendar day expressed in UTC', () {
      const f = DiscoveryFilter(datePreset: DiscoveryDatePreset.today);
      final range = f.dateRange;
      final now = DateTime.now();
      // "Today" means the user's local day: [local midnight, next
      // local midnight], serialized as UTC for the backend. This holds
      // in every timezone (including NZ, where UTC midnight falls
      // mid-local-day).
      expect(
        DateTime.parse(range.startAfter!),
        DateTime(now.year, now.month, now.day).toUtc(),
      );
      expect(
        DateTime.parse(range.startBefore!),
        DateTime(now.year, now.month, now.day, 23, 59, 59, 999).toUtc(),
      );
    });

    test('dateRange with explicit startAfter wins over preset', () {
      final explicit = DateTime(2030, 1, 1, 12);
      final f = DiscoveryFilter(
        datePreset: DiscoveryDatePreset.today,
        startAfter: explicit,
      );
      expect(f.dateRange.startAfter, explicit.toUtc().toIso8601String());
    });

    test('dateRange for anyTime has no bounds', () {
      const f = DiscoveryFilter(datePreset: DiscoveryDatePreset.anyTime);
      expect(f.dateRange.startAfter, isNull);
      expect(f.dateRange.startBefore, isNull);
    });

    test('copyWith preserves unset fields', () {
      const f = DiscoveryFilter(
        sportSkills: [
          DiscoverySportSkill(
            sport: 'Basketball',
            skill: DiscoverySkillLevel.any,
          ),
        ],
      );
      final f2 = f.copyWith(maxDistanceKm: 5);
      expect(f2.sportSkills, f.sportSkills);
      expect(f2.maxDistanceKm, 5);
      expect(f2.datePreset, f.datePreset);
    });

    test('sport skill copyWithSkill swaps the level for the same sport', () {
      const entry = DiscoverySportSkill(
        sport: 'Basketball',
        skill: DiscoverySkillLevel.any,
      );
      final advanced = entry.copyWithSkill(DiscoverySkillLevel.advanced);
      expect(advanced.sport, 'Basketball');
      expect(advanced.skill, DiscoverySkillLevel.advanced);
    });
  });
}
