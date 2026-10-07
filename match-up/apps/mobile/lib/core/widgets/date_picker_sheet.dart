import 'package:flutter/material.dart';

import '../services/weather_service.dart';
import '../theme/app_colors.dart';
import '../theme/app_spacing.dart';
import '../theme/app_typography.dart';
import '../theme/dark_colors.dart';
import 'app_tappable.dart';
import 'pressable_scale.dart';

/// Modal bottom sheet with a calendar + time picker.
/// Returns a [DateTime] that combines the selected date and time via `Navigator.pop(context, dateTime)`, or `null` if.
/// The time picker renders two scrollable columns (hour / minute) in 12-hour format with an AM/PM toggle.
class DatePickerSheet extends StatefulWidget {
  const DatePickerSheet({
    super.key,
    this.initialDate,
    this.minDate,
    this.maxDate,
    this.latitude,
    this.longitude,
  });

  final DateTime? initialDate;
  final DateTime? minDate;
  final DateTime? maxDate;

  /// Venue coords (opsional).
  final double? latitude;
  final double? longitude;

  @override
  State<DatePickerSheet> createState() => _DatePickerSheetState();
}

class _DatePickerSheetState extends State<DatePickerSheet> {
  late DateTime _focused;
  late DateTime _selected;

  // Time state
  late int _hour12; // 1–12
  late int _minute; // 0–59, shown in 5-min steps
  late bool _isPm;

  // Daily + hourly forecast (Open-Meteo, best-effort, one network call).
  Map<DateTime, DailyWeather> _daily = const {};
  Map<DateTime, WeatherInfo> _hourly = const {};

  static const _months = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];
  static const _weekDays = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  /// Minute granularity for the minute drum.
  static const minuteStep = 5;

  @override
  void initState() {
    super.initState();
    final init =
        widget.initialDate ?? DateTime.now().add(const Duration(hours: 1));
    _selected = init;
    _focused = DateTime(_selected.year, _selected.month);

    // Decompose time into 12h + am/pm
    final h = init.hour;
    _isPm = h >= 12;
    _hour12 = h == 0 ? 12 : (h > 12 ? h - 12 : h);
    // Round minute up to nearest step
    _minute = ((init.minute / minuteStep).ceil() * minuteStep) % 60;
    _loadWeather();
  }

  Future<void> _loadWeather() async {
    final lat = widget.latitude;
    final lng = widget.longitude;
    if (lat == null || lng == null) return;
    final results = await Future.wait([
      WeatherService.instance.fetchDaily(lat, lng),
      WeatherService.instance.fetchHourly(lat, lng),
    ]);
    if (!mounted) return;
    setState(() {
      _daily = results[0] as Map<DateTime, DailyWeather>;
      _hourly = results[1] as Map<DateTime, WeatherInfo>;
    });
  }

  DailyWeather? _weatherFor(DateTime d) =>
      _daily[DateTime(d.year, d.month, d.day)];

  WeatherInfo? _hourlyFor(DateTime dt) =>
      _hourly[DateTime(dt.year, dt.month, dt.day, dt.hour)];

  // Helpers.

  bool _inRange(DateTime d) {
    if (widget.minDate != null && d.isBefore(_dateOnly(widget.minDate!))) {
      return false;
    }
    if (widget.maxDate != null && d.isAfter(_dateOnly(widget.maxDate!))) {
      return false;
    }
    return true;
  }

  DateTime _dateOnly(DateTime d) => DateTime(d.year, d.month, d.day);

  void _shiftMonth(int delta) => setState(() {
    _focused = DateTime(_focused.year, _focused.month + delta);
  });

  DateTime get _result {
    final h24 = _isPm
        ? (_hour12 == 12 ? 12 : _hour12 + 12)
        : (_hour12 == 12 ? 0 : _hour12);
    return DateTime(
      _selected.year,
      _selected.month,
      _selected.day,
      h24,
      _minute,
    );
  }

  // Build.

  @override
  Widget build(BuildContext context) {
    final firstDayOfMonth = DateTime(_focused.year, _focused.month, 1);
    final daysInMonth = DateTime(_focused.year, _focused.month + 1, 0).day;
    final leading = firstDayOfMonth.weekday % 7;
    // Only the rows the month actually needs (4–6): a fixed 6-row grid leaves up to two fully blank rows.
    final rowCount = ((leading + daysInMonth) / 7).ceil();

    return SafeArea(
      top: false,
      child: Container(
        decoration: BoxDecoration(
          color: context.colors.surface,
          borderRadius: const BorderRadius.vertical(
            top: Radius.circular(AppRadius.xl),
          ),
        ),
        padding: const EdgeInsets.fromLTRB(
          AppSpacing.x6,
          AppSpacing.x3,
          AppSpacing.x6,
          AppSpacing.x6,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // Drag handle
            Container(
              width: 40,
              height: 4,
              margin: const EdgeInsets.only(bottom: 16),
              decoration: BoxDecoration(
                color: context.colors.border,
                borderRadius: AppRadius.pillR,
              ),
            ),

            // Calendar.
            // Month nav
            Row(
              children: [
                Expanded(
                  child: Text(
                    '${_months[_focused.month - 1]} ${_focused.year}',
                    style: AppTypography.titleLarge(
                      context,
                    ).copyWith(fontWeight: FontWeight.w800, fontSize: 18),
                  ),
                ),
                _navBtn(
                  context,
                  Icons.chevron_left,
                  'Previous month',
                  () => _shiftMonth(-1),
                ),
                const SizedBox(width: 8),
                _navBtn(
                  context,
                  Icons.chevron_right,
                  'Next month',
                  () => _shiftMonth(1),
                ),
              ],
            ),
            const SizedBox(height: 12),
            // Weekday labels
            Row(
              children: _weekDays
                  .map(
                    (w) => Expanded(
                      child: Center(
                        child: Text(
                          w,
                          style: AppTypography.bodySmall(context).copyWith(
                            color: context.colors.textTertiary,
                            fontSize: 11,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                    ),
                  )
                  .toList(),
            ),
            const SizedBox(height: 6),
            // Day grid — only populated rows, no blank trailing rows.
            ...List.generate(rowCount, (row) {
              return Padding(
                padding: const EdgeInsets.symmetric(vertical: 2),
                child: Row(
                  children: List.generate(7, (col) {
                    final index = row * 7 + col;
                    final dayNum = index - leading + 1;
                    if (dayNum < 1 || dayNum > daysInMonth) {
                      return const Expanded(child: SizedBox(height: 52));
                    }
                    final date = DateTime(
                      _focused.year,
                      _focused.month,
                      dayNum,
                    );
                    final isSel = _dateOnly(date) == _dateOnly(_selected);
                    final isToday =
                        _dateOnly(date) == _dateOnly(DateTime.now());
                    final inRange = _inRange(date);
                    return Expanded(
                      child: _DayCell(
                        day: dayNum,
                        isSelected: isSel,
                        isToday: isToday && !isSel,
                        enabled: inRange,
                        weather: _weatherFor(date),
                        onTap: inRange
                            ? () => setState(() => _selected = date)
                            : null,
                      ),
                    );
                  }),
                ),
              );
            }),

            const SizedBox(height: AppSpacing.x2),
            Divider(height: 1, color: context.colors.border),
            const SizedBox(height: AppSpacing.x3),

            // Time picker.
            // Drums keep local state for smooth scrolling.
            _TimeSection(
              hour12: _hour12,
              minute: _minute,
              isPm: _isPm,
              onChanged: (h, m, pm) {
                _hour12 = h;
                _minute = m;
                _isPm = pm;
                setState(() {});
              },
            ),

            const SizedBox(height: AppSpacing.x3),
            _SelectedDayWeather(
              hasCoords: widget.latitude != null && widget.longitude != null,
              hourly: _hourlyFor(_result),
              daily: _weatherFor(_selected),
              result: _result,
            ),

            const SizedBox(height: AppSpacing.x5),

            // Confirm row.
            Row(
              children: [
                Expanded(
                  child: Semantics(
                    button: true,
                    label: 'Cancel',
                    child: PressableScale(
                      onTap: () => Navigator.of(context).pop(),
                      child: Container(
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        decoration: BoxDecoration(
                          color: context.colors.surface,
                          borderRadius: AppRadius.pillR,
                          border: Border.all(color: context.colors.border),
                        ),
                        child: Center(
                          child: Text(
                            'Cancel',
                            style: AppTypography.bodyMedium(context).copyWith(
                              color: context.colors.textSecondary,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  flex: 2,
                  child: Semantics(
                    button: true,
                    label: 'Confirm date and time',
                    child: PressableScale(
                      onTap: () => Navigator.of(context).pop(_result),
                      child: Container(
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        decoration: BoxDecoration(
                          color: AppColors.primary,
                          borderRadius: AppRadius.pillR,
                        ),
                        child: Center(
                          child: Text(
                            'Confirm',
                            style: AppTypography.bodyMedium(context).copyWith(
                              color: AppColors.textOnPrimary,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _navBtn(
    BuildContext context,
    IconData icon,
    String semanticLabel,
    VoidCallback onTap,
  ) {
    return AppTappable(
      onTap: onTap,
      semanticLabel: semanticLabel,
      feedback: AppTapFeedback.scale,
      borderRadius: AppRadius.pill,
      child: Container(
        width: 36,
        height: 36,
        decoration: BoxDecoration(
          color: context.colors.surface,
          borderRadius: AppRadius.pillR,
          border: Border.all(color: context.colors.border),
        ),
        alignment: Alignment.center,
        child: Icon(icon, size: 18, color: context.colors.textPrimary),
      ),
    );
  }
}

// Time section (local state — ticks stay scoped).

/// Hour/minute/AM-PM row with its own [State] so scrolling the drums only rebuilds this subtree.
class _TimeSection extends StatefulWidget {
  const _TimeSection({
    required this.hour12,
    required this.minute,
    required this.isPm,
    required this.onChanged,
  });

  final int hour12;
  final int minute;
  final bool isPm;
  final void Function(int hour12, int minute, bool isPm) onChanged;

  @override
  State<_TimeSection> createState() => _TimeSectionState();
}

class _TimeSectionState extends State<_TimeSection> {
  late int _hour12 = widget.hour12;
  late int _minute = widget.minute;
  late bool _isPm = widget.isPm;

  void _emit() => widget.onChanged(_hour12, _minute, _isPm);

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        // Hour drum
        _TimeColumn(
          values: List.generate(12, (i) => i + 1),
          selected: _hour12,
          label: (v) => v.toString().padLeft(2, '0'),
          onChanged: (v) {
            if (v == _hour12) return;
            setState(() => _hour12 = v);
            _emit();
          },
        ),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: AppSpacing.x2),
          child: Text(
            ':',
            style: AppTypography.titleSheet(
              context,
            ).copyWith(fontSize: 22, fontWeight: FontWeight.w800),
          ),
        ),
        // Minute drum
        _TimeColumn(
          values: List.generate(
            60 ~/ _DatePickerSheetState.minuteStep,
            (i) => i * _DatePickerSheetState.minuteStep,
          ),
          selected: _minute,
          label: (v) => v.toString().padLeft(2, '0'),
          onChanged: (v) {
            if (v == _minute) return;
            setState(() => _minute = v);
            _emit();
          },
        ),
        const SizedBox(width: AppSpacing.x4),
        // AM / PM toggle
        _AmPmToggle(
          isPm: _isPm,
          onChanged: (v) {
            if (v == _isPm) return;
            setState(() => _isPm = v);
            _emit();
          },
        ),
      ],
    );
  }
}

// Time column (scrollable drum).

class _TimeColumn extends StatefulWidget {
  const _TimeColumn({
    required this.values,
    required this.selected,
    required this.label,
    required this.onChanged,
  });

  final List<int> values;
  final int selected;
  final String Function(int) label;
  final ValueChanged<int> onChanged;

  @override
  State<_TimeColumn> createState() => _TimeColumnState();
}

class _TimeColumnState extends State<_TimeColumn> {
  late final FixedExtentScrollController _ctrl;
  static const double _itemH = 44;
  static const int _loopFactor = 200; // large multiplier for seamless wrapping

  /// Settle animation for programmatic drum moves.
  static const _settleDuration = Duration(milliseconds: 350);
  static const _settleCurve = Curves.easeOutCubic;

  @override
  void initState() {
    super.initState();
    final initialIndex = widget.values.indexOf(widget.selected);
    // Centre in the large loop so we can scroll both directions freely
    final startIndex =
        _loopFactor ~/ 2 * widget.values.length +
        (initialIndex < 0 ? 0 : initialIndex);
    _ctrl = FixedExtentScrollController(initialItem: startIndex);
  }

  @override
  void didUpdateWidget(_TimeColumn old) {
    super.didUpdateWidget(old);
    // If parent resets selection externally, glide the drum to match instead of snapping.
    if (old.selected != widget.selected) {
      final idx = widget.values.indexOf(widget.selected);
      if (idx >= 0) {
        final current = _ctrl.selectedItem;
        if (current % widget.values.length == idx) return;
        final base = (current ~/ widget.values.length) * widget.values.length;
        _ctrl.animateToItem(
          base + idx,
          duration: _settleDuration,
          curve: _settleCurve,
        );
      }
    }
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final count = widget.values.length;
    return SizedBox(
      width: 52,
      height: _itemH * 3,
      child: ListWheelScrollView.useDelegate(
        controller: _ctrl,
        itemExtent: _itemH,
        physics: const FixedExtentScrollPhysics(),
        perspective: 0.004,
        diameterRatio: 2.2,
        onSelectedItemChanged: (i) {
          final next = widget.values[i % count];
          // Guard redundant ticks so a settled drum doesn't re-emit.
          if (next == widget.selected) return;
          widget.onChanged(next);
        },
        childDelegate: ListWheelChildBuilderDelegate(
          builder: (context, i) {
            final val = widget.values[i % count];
            final isSelected = val == widget.selected;
            return Center(
              child: AnimatedDefaultTextStyle(
                duration: const Duration(milliseconds: 350),
                curve: Curves.easeOutCubic,
                style: isSelected
                    ? AppTypography.titleSheet(context).copyWith(
                        fontSize: 22,
                        fontWeight: FontWeight.w800,
                        color: context.colors.textPrimary,
                      )
                    : AppTypography.bodyMedium(context).copyWith(
                        fontSize: 17,
                        color: context.colors.textTertiary,
                      ),
                child: Text(widget.label(val)),
              ),
            );
          },
          childCount: _loopFactor * count,
        ),
      ),
    );
  }
}

// AM PM toggle.

class _AmPmToggle extends StatelessWidget {
  const _AmPmToggle({required this.isPm, required this.onChanged});
  final bool isPm;
  final ValueChanged<bool> onChanged;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: context.colors.surfaceMuted,
        borderRadius: BorderRadius.circular(AppRadius.md),
        border: Border.all(color: context.colors.border),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          _Segment(
            label: 'AM',
            selected: !isPm,
            topRadius: true,
            bottomRadius: false,
            onTap: () => onChanged(false),
          ),
          Divider(height: 1, color: context.colors.border),
          _Segment(
            label: 'PM',
            selected: isPm,
            topRadius: false,
            bottomRadius: true,
            onTap: () => onChanged(true),
          ),
        ],
      ),
    );
  }
}

class _Segment extends StatelessWidget {
  const _Segment({
    required this.label,
    required this.selected,
    required this.topRadius,
    required this.bottomRadius,
    required this.onTap,
  });
  final String label;
  final bool selected;
  final bool topRadius;
  final bool bottomRadius;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return AppTappable(
      semanticLabel: label,
      onTap: onTap,
      feedback: AppTapFeedback.scale,
      minSize: 0,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 300),
        curve: Curves.easeOutCubic,
        width: 48,
        height: 38,
        decoration: BoxDecoration(
          color: selected ? AppColors.primary : Colors.transparent,
          borderRadius: BorderRadius.vertical(
            top: topRadius ? const Radius.circular(AppRadius.md) : Radius.zero,
            bottom: bottomRadius
                ? const Radius.circular(AppRadius.md)
                : Radius.zero,
          ),
        ),
        alignment: Alignment.center,
        child: Text(
          label,
          style: AppTypography.chipLabel(context).copyWith(
            fontSize: 13,
            color: selected
                ? AppColors.textOnPrimary
                : context.colors.textSecondary,
            fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
          ),
        ),
      ),
    );
  }
}

// Day cell.

class _DayCell extends StatelessWidget {
  const _DayCell({
    required this.day,
    required this.isSelected,
    required this.isToday,
    required this.enabled,
    required this.onTap,
    this.weather,
  });

  final int day;
  final bool isSelected;
  final bool isToday;
  final bool enabled;
  final VoidCallback? onTap;

  /// Cuaca harian (null = belum dimuat / di luar 16 hari / tanpa venue).
  final DailyWeather? weather;

  @override
  Widget build(BuildContext context) {
    final color = isSelected
        ? AppColors.textOnPrimary
        : (enabled ? context.colors.textPrimary : context.colors.textTertiary);
    final bg = isSelected
        ? AppColors.primary
        : (isToday ? context.colors.primaryLight : Colors.transparent);
    final label = [
      '$day',
      if (isToday) '(today)',
      if (isSelected) '(selected)',
      if (weather != null) '(${weather!.description})',
    ].join(' ');

    final w = weather;
    final showTemp =
        w != null && enabled && !w.tempMax.isNaN && !w.tempMin.isNaN;

    return Semantics(
      button: true,
      label: label,
      enabled: enabled,
      selected: isSelected,
      child: PressableScale(
        onTap: onTap,
        child: Container(
          height: 52,
          margin: const EdgeInsets.symmetric(horizontal: 2),
          decoration: BoxDecoration(
            color: bg,
            borderRadius: BorderRadius.circular(16),
          ),
          alignment: Alignment.center,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    '$day',
                    style: AppTypography.labelField(context).copyWith(
                      fontWeight: isSelected || isToday
                          ? FontWeight.w700
                          : FontWeight.w500,
                      color: color,
                    ),
                  ),
                  if (w != null &&
                      enabled &&
                      w.precipitationProbabilityMax >= 60) ...[
                    const SizedBox(width: 2),
                    Container(
                      width: 5,
                      height: 5,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: isSelected
                            ? AppColors.textOnPrimary
                            : context.colors.primaryOnSurface,
                      ),
                    ),
                  ],
                ],
              ),
              if (showTemp)
                Text(
                  '${w.tempMax.round()}°',
                  style: AppTypography.bodySmall(context).copyWith(
                    fontSize: 10,
                    fontWeight: FontWeight.w600,
                    color: isSelected
                        ? AppColors.textOnPrimary.withValues(alpha: 0.85)
                        : context.colors.textTertiary,
                  ),
                )
              else
                const SizedBox(height: 12),
            ],
          ),
        ),
      ),
    );
  }
}

/// Hourly weather strip for the currently picked date + time.
class _SelectedDayWeather extends StatelessWidget {
  const _SelectedDayWeather({
    required this.hasCoords,
    required this.hourly,
    required this.daily,
    required this.result,
  });

  final bool hasCoords;
  final WeatherInfo? hourly;
  final DailyWeather? daily;
  final DateTime result;

  String _hourLabel(DateTime dt) {
    final h12 = dt.hour == 0 ? 12 : (dt.hour > 12 ? dt.hour - 12 : dt.hour);
    final ampm = dt.hour < 12 ? 'AM' : 'PM';
    return '$h12:${dt.minute.toString().padLeft(2, '0')} $ampm';
  }

  @override
  Widget build(BuildContext context) {
    if (!hasCoords) {
      return Row(
        children: [
          Icon(
            Icons.cloud_outlined,
            size: 16,
            color: context.colors.textTertiary,
          ),
          const SizedBox(width: 6),
          Expanded(
            child: Text(
              'Pick a venue first to see weather per date',
              style: AppTypography.metaSub(context),
            ),
          ),
        ],
      );
    }
    final h = hourly;
    if (h != null) {
      final temp = h.temperatureC.isNaN ? '—' : '${h.temperatureC.round()}°C';
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        decoration: BoxDecoration(
          color: context.colors.surfaceSubtle,
          borderRadius: BorderRadius.circular(AppRadius.md),
          border: Border.all(color: context.colors.border),
        ),
        child: Row(
          children: [
            Icon(h.icon, size: 20, color: context.colors.primaryOnSurface),
            const SizedBox(width: 8),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    '${_hourLabel(result)} · $temp · ${h.description}',
                    style: AppTypography.bodySmall(
                      context,
                    ).copyWith(fontWeight: FontWeight.w700),
                  ),
                  Text(
                    h.precipitationProbability > 0
                        ? 'Rain ${h.precipitationProbability}%'
                        : 'Low rain',
                    style: AppTypography.metaSub(context),
                  ),
                ],
              ),
            ),
          ],
        ),
      );
    }
    final w = daily;
    if (w == null) {
      return Row(
        children: [
          Icon(
            Icons.cloud_outlined,
            size: 16,
            color: context.colors.textTertiary,
          ),
          const SizedBox(width: 6),
          Expanded(
            child: Text(
              'Weather beyond 16 days is unavailable',
              style: AppTypography.metaSub(context),
            ),
          ),
        ],
      );
    }
    final temp = w.tempMax.isNaN || w.tempMin.isNaN
        ? w.description
        : '${w.tempMax.round()}° / ${w.tempMin.round()}° · ${w.description}';
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: context.colors.surfaceSubtle,
        borderRadius: BorderRadius.circular(AppRadius.md),
        border: Border.all(color: context.colors.border),
      ),
      child: Row(
        children: [
          Icon(w.icon, size: 20, color: context.colors.primaryOnSurface),
          const SizedBox(width: 8),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  temp,
                  style: AppTypography.bodySmall(
                    context,
                  ).copyWith(fontWeight: FontWeight.w700),
                ),
                Text(
                  w.precipitationProbabilityMax > 0
                      ? 'Rain ${w.precipitationProbabilityMax}%'
                      : 'Low rain',
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
