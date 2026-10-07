import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/providers/preferences_provider.dart';
import '../../../core/providers/profile_providers.dart';
import '../../../core/providers/repository_providers.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/utils/nav_guard.dart';
import '../../../core/widgets/app_scaffold.dart';
import '../../../core/widgets/app_snackbar.dart';
import '../../../core/widgets/pill_buttons.dart';
import '../../sports/domain/sport_config.dart';
import 'widgets/preference_types.dart';
import 'widgets/preferences_distance_card.dart';
import 'widgets/preferences_hero_summary.dart';
import 'widgets/preferences_price_card.dart';
import 'widgets/preferences_skill_sheet.dart';
import 'widgets/preferences_sport_grid.dart';

class PreferencesScreen extends ConsumerStatefulWidget {
  const PreferencesScreen({super.key});

  @override
  ConsumerState<PreferencesScreen> createState() => _PreferencesScreenState();
}

class _PreferencesScreenState extends ConsumerState<PreferencesScreen> {
  /// Offline fallback catalog — used only when the server sports config is empty/unreachable.
  static const List<SportOption> _fallbackSports = [
    SportOption(name: 'Basketball', icon: Icons.sports_basketball),
    SportOption(name: 'Tennis', icon: Icons.sports_tennis),
    SportOption(name: 'Soccer', icon: Icons.sports_soccer),
    SportOption(name: 'Running', icon: Icons.directions_run),
    SportOption(name: 'Swimming', icon: Icons.pool),
    SportOption(name: 'Cycling', icon: Icons.directions_bike),
    SportOption(name: 'Volleyball', icon: Icons.sports_volleyball),
    SportOption(name: 'Badminton', icon: Icons.sports_handball),
    SportOption(name: 'Fitness', icon: Icons.fitness_center),
    SportOption(name: 'Golf', icon: Icons.sports_golf),
  ];

  /// Best-effort icon for a server-driven sport name.
  static IconData _iconFor(String name) {
    for (final s in _fallbackSports) {
      if (s.name == name) return s.icon;
    }
    return Icons.sports_soccer;
  }

  final Map<String, SkillLevel> _selected = <String, SkillLevel>{};
  double _distanceKm = 5;
  PricePreference _price = PricePreference.both;

  static const double _minDistance = 1;
  static const double _maxDistance = 50;

  // Read initial values from providers on first build.
  bool _initialised = false;
  void _initFromProviders() {
    if (_initialised) return;
    _initialised = true;
    final prefs = ref.read(sportPreferencesProvider);
    for (final e in prefs.entries) {
      final level = SkillLevel.values.firstWhere(
        (l) => l.label == e.value,
        orElse: () => SkillLevel.intermediate,
      );
      _selected[e.key] = level;
    }
    _distanceKm = ref.read(distanceFilterProvider);
    final priceStr = ref.read(priceFilterProvider);
    _price = PricePreference.values.firstWhere(
      (p) => p.label == priceStr,
      orElse: () => PricePreference.both,
    );
  }

  // Persist to providers whenever user applies.
  void _applyToProviders() {
    ref
        .read(sportPreferencesProvider.notifier)
        .setAll(_selected.map((k, v) => MapEntry(k, v.label)));
    ref.read(distanceFilterProvider.notifier).set(_distanceKm);
    ref.read(priceFilterProvider.notifier).set(_price.label);
  }

  int get _selectedCount => _selected.length;

  Map<SkillLevel, int> get _distribution {
    final m = <SkillLevel, int>{for (final s in SkillLevel.values) s: 0};
    for (final l in _selected.values) {
      m[l] = (m[l] ?? 0) + 1;
    }
    return m;
  }

  SkillLevel? get _dominantSkill {
    if (_selected.isEmpty) return null;
    final dist = _distribution;
    SkillLevel? best;
    var bestCount = 0;
    for (final entry in dist.entries) {
      if (entry.value > bestCount) {
        best = entry.key;
        bestCount = entry.value;
      }
    }
    return best;
  }

  String get _filterSummary {
    final parts = <String>[];
    if (_selectedCount > 0) {
      parts.add('$_selectedCount ${_selectedCount == 1 ? 'sport' : 'sports'}');
    }
    parts.add('Within ${_distanceKm.toStringAsFixed(0)} km');
    parts.add(_price.label);
    return parts.join(' · ');
  }

  Future<void> _onTapSport(SportOption option) async {
    final result = await showModalBottomSheet<Object?>(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (sheetCtx) => PreferencesSkillSheet(
        sportName: option.name,
        sportIcon: option.icon,
        current: _selected[option.name],
      ),
    );
    if (!mounted) return;
    if (result is SkillLevel) {
      setState(() => _selected[option.name] = result);
    } else if (result == kClearSportAction) {
      setState(() => _selected.remove(option.name));
    }
  }

  void _reset() => setState(() {
    _selected.clear();
    _distanceKm = 5;
    _price = PricePreference.both;
  });

  /// Applies locally, then syncs the sport picks to the backend profile so they survive reinstalls and seed Discover.
  Future<void> _onApply() async {
    _applyToProviders();
    if (_selected.isNotEmpty) {
      try {
        await ref
            .read(userRepositoryProvider)
            .updateProfile(
              sports: [
                for (final e in _selected.entries)
                  (sport: e.key, level: e.value.label),
              ],
            );
        ref.invalidate(myProfileProvider);
      } catch (_) {
        if (!mounted) return;
        AppSnackbar.show(
          context,
          message: 'Filters applied locally — could not sync to your profile.',
          variant: AppSnackbarVariant.error,
        );
      }
    }
    if (!mounted) return;
    // Per-key guard: rapid double-tap Apply would double-sync and double-go.
    NavGuard.onceFor('preferences-apply', () => context.go('/discovery'));
  }

  @override
  Widget build(BuildContext context) {
    _initFromProviders();
    // Server-driven catalog (filter surface); bundled list is the offline fallback so a failed fetch never empties.
    final sports = [
      for (final name in pickSportNames(
        ref.watch(sportsConfigProvider).valueOrNull ?? const [],
        (s) => s.showInFilter,
        [for (final s in _fallbackSports) s.name],
      ))
        SportOption(name: name, icon: _iconFor(name)),
    ];
    return AppScaffold.detail(
      title: 'Filters',
      showHomeIndicator: false, // reached from inside ShellRoute screens.
      body: Column(
        children: [
          Expanded(
            child: SingleChildScrollView(
              padding: const EdgeInsets.fromLTRB(
                AppSpacing.x5,
                AppSpacing.x2,
                AppSpacing.x5,
                AppSpacing.x4,
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  PreferencesHeroSummary(
                    count: _selectedCount,
                    dominant: _dominantSkill,
                    distribution: _distribution,
                    onReset: _selectedCount == 0 ? null : _reset,
                  ),
                  const SizedBox(height: AppSpacing.x6),
                  const PreferencesSectionLabel(label: 'Your sports'),
                  const SizedBox(height: AppSpacing.x3),
                  PreferencesSportGrid(
                    sports: sports,
                    selected: _selected,
                    onTap: _onTapSport,
                  ),
                  const SizedBox(height: AppSpacing.x6),
                  PreferencesSectionLabel(
                    label: 'Distance',
                    trailing: Text(
                      'Within ${_distanceKm.toStringAsFixed(0)} km',
                      style: AppTypography.chipLabel(
                        context,
                      ).copyWith(color: AppColors.primary),
                    ),
                  ),
                  const SizedBox(height: AppSpacing.x3),
                  PreferencesDistanceCard(
                    value: _distanceKm,
                    min: _minDistance,
                    max: _maxDistance,
                    onChanged: (v) => setState(() => _distanceKm = v),
                  ),
                  const SizedBox(height: AppSpacing.x6),
                  const PreferencesSectionLabel(label: 'Price preference'),
                  const SizedBox(height: AppSpacing.x3),
                  PreferencesPriceCard(
                    value: _price,
                    onChanged: (v) => setState(() => _price = v),
                  ),
                ],
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(
              AppSpacing.x5,
              AppSpacing.x2,
              AppSpacing.x5,
              AppSpacing.x3,
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                PrimaryPillButton(
                  label: _selectedCount == 0
                      ? 'Show all activities'
                      : 'Apply Filters',
                  onPressed: _onApply,
                ),
                const SizedBox(height: AppSpacing.x2),
                Text(
                  _filterSummary,
                  textAlign: TextAlign.center,
                  style: AppTypography.metaSub(context),
                ),
                // Honest sync scope: only sports reach the backend profile.
                Text(
                  'Sports sync to your profile · Distance & price stay on this device',
                  textAlign: TextAlign.center,
                  style: AppTypography.metaSub(context),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
