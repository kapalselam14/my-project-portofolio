import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/theme/dark_colors.dart';
import '../../../core/widgets/app_icon.dart';
import '../../../core/widgets/app_scaffold.dart';
import '../../../core/widgets/app_tappable.dart';
import '../../../core/providers/repository_providers.dart';
import '../../sports/domain/sport_config.dart';
import '../domain/discovery_filter.dart';
import 'discovery_screen.dart' show discoveryFilterProvider;

// Models.

enum _DatePreset { today, tomorrow, thisWeekend, thisWeek, custom }

extension _DatePresetLabel on _DatePreset {
  String get label {
    switch (this) {
      case _DatePreset.today:
        return 'Today';
      case _DatePreset.tomorrow:
        return 'Tomorrow';
      case _DatePreset.thisWeekend:
        return 'This Weekend';
      case _DatePreset.thisWeek:
        return 'This Week';
      case _DatePreset.custom:
        return 'Pick dates';
    }
  }
}

extension _DiscoverySkillLevelLabel on DiscoverySkillLevel {
  String get label {
    switch (this) {
      case DiscoverySkillLevel.any:
        return 'Any';
      case DiscoverySkillLevel.beginner:
        return 'Beginner';
      case DiscoverySkillLevel.intermediate:
        return 'Intermediate';
      case DiscoverySkillLevel.advanced:
        return 'Advanced';
    }
  }
}

// Screen.

class FilterScreen extends ConsumerStatefulWidget {
  const FilterScreen({super.key});

  @override
  ConsumerState<FilterScreen> createState() => _FilterScreenState();
}

class _FilterScreenState extends ConsumerState<FilterScreen> {
  static const _fallbackSports = [
    'Basketball',
    'Tennis',
    'Soccer',
    'Running',
    'Swimming',
    'Cycling',
    'Volleyball',
    'Badminton',
    'Fitness',
    'Golf',
  ];

  /// Admin-curated filter list; bundled fallback while loading/offline.
  late List<String> _sportsLive = _fallbackSports;
  List<String> get _sports => _sportsLive;

  /// Local working copy — written to the session provider on Apply.
  late DiscoveryFilter _draft;

  @override
  void initState() {
    super.initState();
    _draft = ref.read(discoveryFilterProvider);
  }

  void _reset() {
    setState(() {
      _draft = _draft.copyWith(
        sportSkills: const [],
        clearDates: true,
        clearDistance: true,
      );
    });
  }

  /// Toggles are keyed by sport NAME, not list index: the server list can churn between build and tap.
  void _toggleSport(String sport) {
    setState(() {
      final existing = _draft.sportSkills.indexWhere((s) => s.sport == sport);
      if (existing >= 0) {
        _draft = _draft.copyWith(
          sportSkills: List.of(_draft.sportSkills)..removeAt(existing),
        );
      } else {
        _draft = _draft.copyWith(
          sportSkills: [
            ..._draft.sportSkills,
            DiscoverySportSkill(sport: sport, skill: DiscoverySkillLevel.any),
          ],
        );
      }
    });
  }

  void _setSkill(String sport, DiscoverySkillLevel level) {
    setState(() {
      final updated = _draft.sportSkills
          .map((s) => s.sport == sport ? s.copyWithSkill(level) : s)
          .toList();
      _draft = _draft.copyWith(sportSkills: updated);
    });
  }

  Future<void> _pickCustomRange() async {
    final now = DateTime.now();
    final start = _draft.startAfter ?? now;
    final end = _draft.startBefore ?? now.add(const Duration(days: 3));
    final range = await showDateRangePicker(
      context: context,
      firstDate: now,
      lastDate: now.add(const Duration(days: 365)),
      initialDateRange: DateTimeRange(start: start, end: end),
      builder: (context, child) => Theme(
        data: Theme.of(context).copyWith(
          colorScheme: const ColorScheme.light(
            primary: AppColors.primary,
            onPrimary: AppColors.textOnPrimary,
            surface: Colors.white,
          ),
        ),
        child: child!,
      ),
    );
    if (range != null) {
      setState(() {
        // A custom range wins over any preset highlight: reset the preset to anyTime while keeping the explicit dates.
        _draft = _draft.copyWith(
          datePreset: DiscoveryDatePreset.anyTime,
          startAfter: DateTime(
            range.start.year,
            range.start.month,
            range.start.day,
          ),
          startBefore: DateTime(
            range.end.year,
            range.end.month,
            range.end.day,
            23,
            59,
            59,
            999,
          ),
        );
      });
    }
  }

  String get _dateLabel {
    if (_draft.startAfter != null || _draft.startBefore != null) {
      final fmt = DateFormat('d MMM');
      final start = _draft.startAfter;
      final end = _draft.startBefore;
      if (start != null && end != null) {
        return '${fmt.format(start)} – ${fmt.format(end)}';
      }
    }
    return _draft.datePreset.label;
  }

  String get _distanceLabel => _draft.maxDistanceKm == null
      ? 'Any'
      : 'Within ${_draft.maxDistanceKm!.round()} km';

  String get _sportsLabel => _draft.sportSkills.isEmpty
      ? 'All sports'
      : _draft.sportSkills.length == 1
      ? _draft.sportSkills.first.sport
      : '${_draft.sportSkills.length} sports';

  void _onDatePresetSelected(_DatePreset preset) {
    if (preset == _DatePreset.custom) {
      _pickCustomRange();
      return;
    }
    // Map the local-widget enum to the wire-typed enum.
    final wirePreset = DiscoveryDatePreset.values.byName(preset.name);
    setState(() {
      // Selecting a preset drops any custom range: `clearDates` is the only way to clear dates through copyWith.
      _draft = _draft.copyWith(
        datePreset: _draft.datePreset == wirePreset
            ? DiscoveryDatePreset.anyTime
            : wirePreset,
        clearDates: true,
      );
    });
  }

  Future<void> _apply() async {
    debugPrint(
      '[FilterScreen._apply] draft.sportSkills=${_draft.sportSkills.length} '
      'datePreset=${_draft.datePreset} '
      'maxDistanceKm=${_draft.maxDistanceKm} '
      'isEmpty=${_draft.isEmpty}',
    );
    // Always write to the provider — even when the draft is empty, because the Discovery screen's `ref.listenManual`.
    ref.read(discoveryFilterProvider.notifier).state = _draft;
    // On a deep link there may be nothing to pop.
    if (await Navigator.of(context).maybePop() == false && mounted) {
      context.go('/discovery');
    }
  }

  @override
  Widget build(BuildContext context) {
    // Subscribe: a late-arriving server config rebuilds the list.
    _sportsLive = pickSportNames(
      ref.watch(sportsConfigProvider).valueOrNull ?? const [],
      (s) => s.showInFilter,
      _fallbackSports,
    );
    // Drop skill selections whose sport vanished from the server list (silent prune — no snackbar).
    if (_draft.sportSkills.any((s) => !_sportsLive.contains(s.sport))) {
      _draft = _draft.copyWith(
        sportSkills: [
          for (final s in _draft.sportSkills)
            if (_sportsLive.contains(s.sport)) s,
        ],
      );
    }
    return AppScaffold.sheet(
      title: 'Filters',
      trailingAction: 'Reset',
      onTrailingAction: _reset,
      showHomeIndicator: false,
      backgroundColor: context.colors.background,
      body: Column(
        children: [
          Expanded(
            child: SingleChildScrollView(
              padding: const EdgeInsets.fromLTRB(
                AppSpacing.x5,
                AppSpacing.x3,
                AppSpacing.x5,
                AppSpacing.x4,
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Alert banner when no sport selected
                  if (_draft.sportSkills.isEmpty) ...[
                    _NoBannerHint(),
                    const SizedBox(height: AppSpacing.x4),
                  ],

                  // Sports + per-sport skill level
                  _SectionCard(
                    header: _SectionHeader(
                      title: 'Your sports',
                      trailing: _draft.sportSkills.isNotEmpty
                          ? Text(
                              '${_draft.sportSkills.length} selected',
                              style: AppTypography.caption(context).copyWith(
                                color: context.colors.primaryOnSurface,
                              ),
                            )
                          : null,
                    ),
                    child: _SportsWithSkills(
                      sports: _sports,
                      selected: _draft.sportSkills,
                      onToggleSport: _toggleSport,
                      onSetSkill: _setSkill,
                    ),
                  ),
                  const SizedBox(height: AppSpacing.x4),

                  // Date
                  _SectionCard(
                    header: const _SectionHeader(title: 'When'),
                    child: _DatePresetGrid(
                      // A custom range clears the preset highlight, so it selects the "Pick dates" pill instead.
                      selected:
                          _draft.startAfter != null ||
                              _draft.startBefore != null
                          ? _DatePreset.custom
                          : _draft.datePreset == DiscoveryDatePreset.anyTime
                          ? null
                          : _DatePreset.values.byName(_draft.datePreset.name),
                      hasCustomRange:
                          _draft.startAfter != null ||
                          _draft.startBefore != null,
                      onSelect: _onDatePresetSelected,
                    ),
                  ),
                  const SizedBox(height: AppSpacing.x4),

                  // Distance
                  _SectionCard(
                    header: _SectionHeader(
                      title: 'Distance',
                      trailing: _DistancePill(
                        km: _draft.maxDistanceKm?.round(),
                      ),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Expanded(
                              child: Text(
                                _draft.maxDistanceKm == null
                                    ? 'Any distance'
                                    : 'Within ${_draft.maxDistanceKm!.round()} km',
                                style: AppTypography.metaSub(context),
                              ),
                            ),
                            AppTappable(
                              semanticLabel: 'Any distance',
                              feedback: AppTapFeedback.scale,
                              minSize: 0,
                              onTap: _draft.maxDistanceKm == null
                                  ? null
                                  : () => setState(() {
                                      _draft = _draft.copyWith(
                                        clearDistance: true,
                                      );
                                    }),
                              child: Container(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: AppSpacing.x3,
                                  vertical: 4,
                                ),
                                decoration: BoxDecoration(
                                  color: _draft.maxDistanceKm == null
                                      ? AppColors.primary
                                      : context.colors.surfaceMuted,
                                  borderRadius: BorderRadius.circular(
                                    AppRadius.pill,
                                  ),
                                  border: Border.all(
                                    color: _draft.maxDistanceKm == null
                                        ? AppColors.primary
                                        : context.colors.border,
                                  ),
                                ),
                                child: Text(
                                  'Any',
                                  style: AppTypography.chipLabel(context)
                                      .copyWith(
                                        fontSize: 12,
                                        color: _draft.maxDistanceKm == null
                                            ? AppColors.textOnPrimary
                                            : context.colors.textSecondary,
                                        fontWeight: _draft.maxDistanceKm == null
                                            ? FontWeight.w700
                                            : FontWeight.w400,
                                      ),
                                ),
                              ),
                            ),
                          ],
                        ),
                        _DistanceSlider(
                          distanceKm: _draft.maxDistanceKm ?? 10,
                          onChanged: (v) => setState(() {
                            _draft = _draft.copyWith(maxDistanceKm: v);
                          }),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),

          // Pinned CTA
          _ApplyBar(
            sportsLabel: _sportsLabel,
            distanceLabel: _distanceLabel,
            dateLabel: _dateLabel,
            onApply: _apply,
          ),
        ],
      ),
    );
  }
}

// Sports inline skill level.

class _SportsWithSkills extends StatelessWidget {
  const _SportsWithSkills({
    required this.sports,
    required this.selected,
    required this.onToggleSport,
    required this.onSetSkill,
  });

  final List<String> sports;

  /// Selected sport+skill entries from the parent state, in the order they were added.
  final List<DiscoverySportSkill> selected;
  final ValueChanged<String> onToggleSport;
  final void Function(String sport, DiscoverySkillLevel level) onSetSkill;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Sport pills
        Wrap(
          spacing: AppSpacing.x2,
          runSpacing: AppSpacing.x2,
          children: List.generate(sports.length, (i) {
            final sport = sports[i];
            final isSelected = selected.any((s) => s.sport == sport);
            return _SportPill(
              label: sport,
              selected: isSelected,
              onTap: () => onToggleSport(sport),
            );
          }),
        ),

        // Per-sport skill rows — render one card per selected sport.
        if (selected.isNotEmpty) ...[
          const SizedBox(height: AppSpacing.x4),
          const _SkillDivider(),
          const SizedBox(height: AppSpacing.x3),
          ...selected.map((entry) {
            // Keyed by name (not index): entries pruned from the server list never reach here, and indices can't go.
            if (!sports.contains(entry.sport)) {
              return const SizedBox.shrink();
            }
            return Padding(
              padding: const EdgeInsets.only(bottom: AppSpacing.x3),
              child: _SportSkillRow(
                sportName: entry.sport,
                current: entry.skill,
                onChanged: (level) => onSetSkill(entry.sport, level),
              ),
            );
          }),
        ],
      ],
    );
  }
}

class _SkillDivider extends StatelessWidget {
  const _SkillDivider();

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(child: Divider(height: 1, color: context.colors.border)),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: AppSpacing.x2),
          child: Text(
            'Skill level per sport',
            style: AppTypography.metaSub(context).copyWith(fontSize: 11),
          ),
        ),
        Expanded(child: Divider(height: 1, color: context.colors.border)),
      ],
    );
  }
}

class _SportSkillRow extends StatelessWidget {
  const _SportSkillRow({
    required this.sportName,
    required this.current,
    required this.onChanged,
  });

  final String sportName;
  final DiscoverySkillLevel current;
  final ValueChanged<DiscoverySkillLevel> onChanged;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(sportName, style: AppTypography.labelField(context)),
        const SizedBox(height: AppSpacing.x2),
        // Segmented pill row — Any / Beginner / Intermediate / Advanced
        _SkillSegment(current: current, onChanged: onChanged),
      ],
    );
  }
}

class _SkillSegment extends StatelessWidget {
  const _SkillSegment({required this.current, required this.onChanged});
  final DiscoverySkillLevel current;
  final ValueChanged<DiscoverySkillLevel> onChanged;

  static const _levels = DiscoverySkillLevel.values;

  @override
  Widget build(BuildContext context) {
    // Four segments ("Intermediate" is long) overflow narrow screens, so the row scrolls horizontally.
    return LayoutBuilder(
      builder: (context, constraints) {
        const minSeg = 108.0;
        final full = constraints.maxWidth.isFinite
            ? constraints.maxWidth
            : minSeg * 4;
        final segW = (full / 4).clamp(minSeg, 220.0);
        final innerW = segW * 4;
        return SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: Container(
            height: 38,
            width: innerW > full ? innerW : full,
            decoration: BoxDecoration(
              color: context.colors.surfaceMuted,
              borderRadius: BorderRadius.circular(AppRadius.lg),
            ),
            child: Row(
              children: _levels.map((level) {
                final isSelected = level == current;
                return SizedBox(
                  width: segW,
                  child: AppTappable(
                    semanticLabel: level.label,
                    onTap: () => onChanged(level),
                    feedback: AppTapFeedback.scale,
                    minSize: 0,
                    child: AnimatedContainer(
                      duration: const Duration(milliseconds: 150),
                      margin: const EdgeInsets.all(3),
                      decoration: BoxDecoration(
                        color: isSelected
                            ? AppColors.primary
                            : Colors.transparent,
                        borderRadius: BorderRadius.circular(AppRadius.sm),
                      ),
                      alignment: Alignment.center,
                      child: Text(
                        level.label,
                        style: AppTypography.metaSub(context).copyWith(
                          fontSize: 11,
                          color: isSelected
                              ? AppColors.textOnPrimary
                              : context.colors.textSecondary,
                          fontWeight: isSelected
                              ? FontWeight.w700
                              : FontWeight.w400,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  ),
                );
              }).toList(),
            ),
          ),
        );
      },
    );
  }
}

// Section card wrapper.

class _SectionCard extends StatelessWidget {
  const _SectionCard({required this.header, required this.child});
  final Widget header;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(AppSpacing.x4),
      decoration: BoxDecoration(
        color: context.colors.surface,
        borderRadius: BorderRadius.circular(AppRadius.card),
        border: Border.all(color: context.colors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          header,
          const SizedBox(height: AppSpacing.x3),
          child,
        ],
      ),
    );
  }
}

class _SectionHeader extends StatelessWidget {
  const _SectionHeader({required this.title, this.trailing});
  final String title;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(child: Text(title, style: AppTypography.titleMedium(context))),
        ?trailing,
      ],
    );
  }
}

// Alert banner.

class _NoBannerHint extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(AppSpacing.x4),
      decoration: BoxDecoration(
        color: context.colors.surface,
        borderRadius: BorderRadius.circular(AppRadius.card),
        border: Border.all(
          color: context.colors.primaryOnSurface.withValues(alpha: 0.4),
        ),
      ),
      child: Row(
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: context.colors.primarySoft,
              shape: BoxShape.circle,
            ),
            alignment: Alignment.center,
            child: AppIcon(
              AppIcons.bell,
              size: AppIconSize.md,
              color: context.colors.primaryOnSurface,
            ),
          ),
          const SizedBox(width: AppSpacing.x3),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'No sports selected',
                  style: AppTypography.labelField(context),
                ),
                const SizedBox(height: 2),
                Text(
                  'Pick the sports you play to discover games',
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

// Sport pill.

class _SportPill extends StatelessWidget {
  const _SportPill({
    required this.label,
    required this.selected,
    required this.onTap,
  });
  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return AppTappable(
      semanticLabel: label,
      onTap: onTap,
      feedback: AppTapFeedback.scale,
      minSize: 0,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.x4,
          vertical: AppSpacing.x2 + 2,
        ),
        decoration: BoxDecoration(
          color: selected
              ? context.colors.primarySoft
              : context.colors.surfaceMuted,
          borderRadius: BorderRadius.circular(AppRadius.pill),
          border: Border.all(
            color: selected
                ? context.colors.primaryOnSurface
                : context.colors.border,
            width: selected ? 1.5 : 1,
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (selected) ...[
              Icon(
                Icons.check_rounded,
                size: 13,
                color: context.colors.primaryOnSurface,
              ),
              const SizedBox(width: 4),
            ],
            Text(
              label,
              style: AppTypography.chipLabel(context).copyWith(
                fontSize: 13,
                color: selected
                    ? context.colors.primaryOnSurface
                    : context.colors.textSecondary,
                fontWeight: selected ? FontWeight.w700 : FontWeight.w400,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// Date preset grid.

class _DatePresetGrid extends StatelessWidget {
  const _DatePresetGrid({
    required this.selected,
    required this.hasCustomRange,
    required this.onSelect,
  });

  /// Local-widget enum (today / tomorrow / etc.) for the pill UI.
  final _DatePreset? selected;

  /// Whether the user has picked a custom date range.
  final bool hasCustomRange;
  final ValueChanged<_DatePreset> onSelect;

  static const _presets = _DatePreset.values;

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: AppSpacing.x2,
      runSpacing: AppSpacing.x2,
      children: _presets.map((preset) {
        final isSelected = selected == preset;
        final label =
            (preset == _DatePreset.custom && isSelected && hasCustomRange)
            ? 'Custom range'
            : preset.label;

        return AppTappable(
          semanticLabel: preset.label,
          onTap: () => onSelect(preset),
          feedback: AppTapFeedback.scale,
          minSize: 0,
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 150),
            padding: const EdgeInsets.symmetric(
              horizontal: AppSpacing.x4,
              vertical: AppSpacing.x2 + 2,
            ),
            decoration: BoxDecoration(
              color: isSelected
                  ? context.colors.primarySoft
                  : context.colors.surfaceMuted,
              borderRadius: BorderRadius.circular(AppRadius.pill),
              border: Border.all(
                color: isSelected
                    ? context.colors.primaryOnSurface
                    : context.colors.border,
                width: isSelected ? 1.5 : 1,
              ),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                if (preset == _DatePreset.custom)
                  Padding(
                    padding: const EdgeInsets.only(right: 4),
                    child: Icon(
                      Icons.calendar_month_rounded,
                      size: 13,
                      color: context.colors.primaryOnSurface,
                    ),
                  ),
                Text(
                  label,
                  style: AppTypography.chipLabel(context).copyWith(
                    fontSize: 13,
                    color: isSelected
                        ? context.colors.primaryOnSurface
                        : context.colors.textSecondary,
                    fontWeight: isSelected ? FontWeight.w700 : FontWeight.w400,
                  ),
                ),
              ],
            ),
          ),
        );
      }).toList(),
    );
  }
}

// Distance pill label.

class _DistancePill extends StatelessWidget {
  const _DistancePill({required this.km});
  final int? km;

  @override
  Widget build(BuildContext context) {
    if (km == null) {
      return const SizedBox.shrink();
    }
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.x3,
        vertical: 4,
      ),
      decoration: BoxDecoration(
        color: AppColors.primary,
        borderRadius: BorderRadius.circular(AppRadius.pill),
      ),
      child: Text(
        'Within $km km',
        style: AppTypography.chipLabel(
          context,
        ).copyWith(color: AppColors.textOnPrimary, fontSize: 12),
      ),
    );
  }
}

// Distance slider.

class _DistanceSlider extends StatelessWidget {
  const _DistanceSlider({required this.distanceKm, required this.onChanged});
  final double distanceKm;
  final ValueChanged<double> onChanged;

  static const double _min = 1;
  static const double _max = 50;
  static const _ticks = ['1 km', '10 km', '30 km', '50 km'];

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('How far will you go?', style: AppTypography.metaSub(context)),
        const SizedBox(height: AppSpacing.x1),
        SliderTheme(
          data: SliderTheme.of(context).copyWith(
            trackHeight: 3,
            activeTrackColor: AppColors.primary,
            inactiveTrackColor: context.colors.border,
            thumbColor: AppColors.primary,
            overlayColor: AppColors.primary.withValues(alpha: 0.12),
            thumbShape: const RoundSliderThumbShape(enabledThumbRadius: 10),
            overlayShape: const RoundSliderOverlayShape(overlayRadius: 18),
          ),
          child: Slider(
            value: distanceKm.clamp(_min, _max),
            min: _min,
            max: _max,
            onChanged: onChanged,
          ),
        ),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 4),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: _ticks
                .map((t) => Text(t, style: AppTypography.metaSub(context)))
                .toList(),
          ),
        ),
      ],
    );
  }
}

// Apply bar.

class _ApplyBar extends StatelessWidget {
  const _ApplyBar({
    required this.sportsLabel,
    required this.distanceLabel,
    required this.dateLabel,
    required this.onApply,
  });
  final String sportsLabel;
  final String distanceLabel;
  final String dateLabel;
  final VoidCallback onApply;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.x5,
        AppSpacing.x3,
        AppSpacing.x5,
        AppSpacing.x5,
      ),
      decoration: BoxDecoration(
        color: context.colors.surface,
        boxShadow: AppShadows.bottomBar,
      ),
      child: AppTappable(
        semanticLabel: 'Show all activities',
        onTap: onApply,
        feedback: AppTapFeedback.scale,
        minSize: 0,
        child: Container(
          height: 58,
          decoration: BoxDecoration(
            color: AppColors.primary,
            borderRadius: BorderRadius.circular(AppRadius.pill),
            boxShadow: AppShadows.glowPrimary,
          ),
          alignment: Alignment.center,
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text('Show all activities', style: AppTypography.buttonPrimary),
              const SizedBox(height: 2),
              Text(
                '$sportsLabel · $dateLabel · $distanceLabel',
                style: AppTypography.metaSub(context).copyWith(
                  color: AppColors.textOnPrimary.withValues(alpha: 0.75),
                  fontSize: 11,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
