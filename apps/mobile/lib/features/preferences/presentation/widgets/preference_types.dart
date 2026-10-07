import 'package:flutter/material.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/dark_colors.dart';

/// Skill level for a single sport preference.
enum SkillLevel { beginner, intermediate, advanced, any }

extension SkillLevelX on SkillLevel {
  String get label => switch (this) {
    SkillLevel.beginner => 'Beginner',
    SkillLevel.intermediate => 'Intermediate',
    SkillLevel.advanced => 'Advanced',
    SkillLevel.any => 'Any',
  };

  String get short => switch (this) {
    SkillLevel.beginner => 'Beg',
    SkillLevel.intermediate => 'Int',
    SkillLevel.advanced => 'Adv',
    SkillLevel.any => 'Any',
  };

  Color color(BuildContext context) => switch (this) {
    SkillLevel.beginner => context.colors.successText,
    SkillLevel.intermediate => AppColors.primary,
    SkillLevel.advanced => context.colors.warningText,
    SkillLevel.any => context.colors.textSecondary,
  };
}

/// Price preference for the discovery feed filter.
enum PricePreference { free, paid, both }

extension PricePreferenceX on PricePreference {
  String get label => switch (this) {
    PricePreference.free => 'Free',
    PricePreference.paid => 'Paid',
    PricePreference.both => 'Both',
  };

  IconData get icon => switch (this) {
    PricePreference.free => Icons.local_offer_outlined,
    PricePreference.paid => Icons.payments_outlined,
    PricePreference.both => Icons.all_inclusive,
  };
}

/// A single sport option in the preferences grid.
class SportOption {
  const SportOption({required this.name, required this.icon});

  final String name;
  final IconData icon;
}
