import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:matchup_mobile/core/utils/nav_guard.dart';

import '../../../core/providers/repository_providers.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/theme/dark_colors.dart';
import '../../../core/widgets/app_icon.dart';
import '../../../core/widgets/app_scaffold.dart';
import '../../../core/widgets/app_snackbar.dart';
import '../../../core/widgets/empty_state.dart';
import '../../../core/widgets/error_retry.dart';
import '../../../core/widgets/notification_icon_button.dart';
import '../../../core/widgets/pressable_scale.dart';
import '../../../core/widgets/skeleton.dart';
import '../domain/calendar_event.dart';

final _upcomingEventsProvider = FutureProvider.autoDispose<List<CalendarEvent>>(
  (ref) => ref.watch(calendarRepositoryProvider).upcoming(),
);

class CalendarScreen extends ConsumerStatefulWidget {
  const CalendarScreen({super.key});

  @override
  ConsumerState<CalendarScreen> createState() => _CalendarScreenState();
}

class _CalendarScreenState extends ConsumerState<CalendarScreen> {
  late DateTime _viewMonth;
  late int? _selectedDay;

  @override
  void initState() {
    super.initState();
    final now = DateTime.now();
    _viewMonth = DateTime(now.year, now.month);
    _selectedDay = now.day; // default to today
  }

  void _shiftMonth(int delta) {
    setState(() {
      _viewMonth = DateTime(_viewMonth.year, _viewMonth.month + delta);
      // Keep the selected day when it exists in the newly viewed month.
      final daysInMonth = DateTime(
        _viewMonth.year,
        _viewMonth.month + 1,
        0,
      ).day;
      if (_selectedDay == null || _selectedDay! > daysInMonth) {
        _selectedDay = 1;
      }
    });
  }

  void _selectDay(int day, bool faded) {
    if (faded) return;
    setState(() => _selectedDay = _selectedDay == day ? null : day);
  }

  String _monthLabel() => DateFormat('MMMM yyyy').format(_viewMonth);

  String _todayLabel() =>
      'Today, ${DateFormat('MMM d').format(DateTime.now())}';

  @override
  Widget build(BuildContext context) {
    final async = ref.watch(_upcomingEventsProvider);

    return AppScaffold.detail(
      title: 'Calendar',
      showHomeIndicator: false,
      actions: [
        NotificationIconButton(
          onTap: () => NavGuard.push(context, '/notifications'),
        ),
      ],
      body: Column(
        children: [
          _MonthNav(
            label: _monthLabel(),
            onPrev: () => _shiftMonth(-1),
            onNext: () => _shiftMonth(1),
          ),
          Expanded(
            child: async.when(
              loading: () => const SkeletonList(count: 4),
              error: (_, _) => ErrorRetry(
                message: 'Could not load your calendar.',
                onRetry: () => ref.invalidate(_upcomingEventsProvider),
              ),
              data: (events) => _CalendarBody(
                viewMonth: _viewMonth,
                selectedDay: _selectedDay,
                events: events,
                monthLabel: _monthLabel(),
                todayLabel: _todayLabel(),
                onSelectDay: _selectDay,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _CalendarBody extends ConsumerWidget {
  const _CalendarBody({
    required this.viewMonth,
    required this.selectedDay,
    required this.events,
    required this.monthLabel,
    required this.todayLabel,
    required this.onSelectDay,
  });

  final DateTime viewMonth;
  final int? selectedDay;
  final List<CalendarEvent> events;
  final String monthLabel;
  final String todayLabel;
  final void Function(int day, bool faded) onSelectDay;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final today = DateTime.now();
    final isCurrentMonth =
        today.year == viewMonth.year && today.month == viewMonth.month;
    final firstOfMonth = DateTime(viewMonth.year, viewMonth.month, 1);
    final daysInMonth = DateTime(viewMonth.year, viewMonth.month + 1, 0).day;
    final leading = firstOfMonth.weekday % 7;
    final prevMonthDays = DateTime(viewMonth.year, viewMonth.month, 0).day;
    final rows = ((leading + daysInMonth + 6) ~/ 7);

    // Days in the *currently viewed* month that have at least one event.
    final activityDays = events
        .where(
          (e) =>
              e.start.year == viewMonth.year &&
              e.start.month == viewMonth.month,
        )
        .map((e) => e.start.day)
        .toSet();

    final cells = <_DayCell>[];
    for (var i = 0; i < leading; i++) {
      cells.add(_DayCell(day: prevMonthDays - leading + i + 1, faded: true));
    }
    for (var d = 1; d <= daysInMonth; d++) {
      final isToday = isCurrentMonth && d == today.day;
      cells.add(
        _DayCell(
          day: d,
          isToday: isToday,
          hasActivity: activityDays.contains(d),
          isSelected: selectedDay == d,
          onTap: () => onSelectDay(d, false),
        ),
      );
    }
    var nextDay = 1;
    while (cells.length < rows * 7) {
      cells.add(_DayCell(day: nextDay++, faded: true));
    }

    final showingMonth = selectedDay == null;
    // No day selected (tapping the selected day again toggles it off): list the whole viewed month, not today.
    final dayEvents = showingMonth
        ? events
              .where(
                (e) =>
                    e.start.year == viewMonth.year &&
                    e.start.month == viewMonth.month,
              )
              .toList()
        : events
              .where(
                (e) =>
                    e.start.year == viewMonth.year &&
                    e.start.month == viewMonth.month &&
                    e.start.day == selectedDay,
              )
              .toList();

    final dateLabel = selectedDay != null
        ? '$monthLabel, $selectedDay'
        : monthLabel;

    return Column(
      children: [
        _CalendarGrid(cells: cells),
        Divider(height: 1, color: context.colors.border),
        Expanded(
          child: RefreshIndicator(
            onRefresh: () async {
              ref.invalidate(_upcomingEventsProvider);
              await ref
                  .read(_upcomingEventsProvider.future)
                  .then((_) {})
                  .catchError((_) {});
            },
            color: AppColors.primary,
            child: ListView(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.fromLTRB(
                AppSpacing.x5,
                AppSpacing.x4,
                AppSpacing.x5,
                AppSpacing.x4,
              ),
              children: [
                _ScheduleHeader(label: dateLabel, count: dayEvents.length),
                const SizedBox(height: AppSpacing.x3),
                if (dayEvents.isEmpty)
                  const Padding(
                    padding: EdgeInsets.symmetric(vertical: AppSpacing.x8),
                    child: EmptyState(
                      icon: Icons.calendar_today_outlined,
                      title: 'No activities on this day',
                      subtitle: 'Games you join or host will appear here.',
                    ),
                  )
                else
                  for (final event in dayEvents) _EventCard(event: event),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

class _MonthNav extends StatelessWidget {
  const _MonthNav({
    required this.label,
    required this.onPrev,
    required this.onNext,
  });

  final String label;
  final VoidCallback onPrev;
  final VoidCallback onNext;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.x5,
        AppSpacing.x2,
        AppSpacing.x5,
        AppSpacing.x4,
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          _NavBtn(
            icon: AppIcons.chevronLeft,
            onTap: onPrev,
            semanticLabel: 'Previous month',
          ),
          Text(label, style: AppTypography.titleMedium(context)),
          _NavBtn(
            icon: AppIcons.chevronRight,
            onTap: onNext,
            semanticLabel: 'Next month',
          ),
        ],
      ),
    );
  }
}

class _NavBtn extends StatelessWidget {
  const _NavBtn({
    required this.icon,
    required this.onTap,
    required this.semanticLabel,
  });
  final String icon;
  final VoidCallback onTap;
  final String semanticLabel;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: semanticLabel,
      child: PressableScale(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.all(AppSpacing.x2),
          decoration: BoxDecoration(
            color: context.colors.background,
            borderRadius: AppRadius.pillR,
            border: Border.all(color: context.colors.border),
          ),
          child: AppIcon(icon, size: AppIconSize.sm),
        ),
      ),
    );
  }
}

class _CalendarGrid extends StatelessWidget {
  const _CalendarGrid({required this.cells});
  final List<_DayCell> cells;

  static const _dowLabels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.x5),
      child: Column(
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: _dowLabels
                .map(
                  (l) => SizedBox(
                    width: 40,
                    child: Center(
                      child: Text(l, style: AppTypography.labelField(context)),
                    ),
                  ),
                )
                .toList(),
          ),
          const SizedBox(height: AppSpacing.x3),
          for (var r = 0; r < (cells.length / 7).ceil(); r++) ...[
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: cells.skip(r * 7).take(7).toList(),
            ),
            if (r < (cells.length / 7).ceil() - 1)
              const SizedBox(height: AppSpacing.x3),
          ],
        ],
      ),
    );
  }
}

class _DayCell extends StatelessWidget {
  const _DayCell({
    required this.day,
    this.faded = false,
    this.isToday = false,
    this.hasActivity = false,
    this.isSelected = false,
    this.onTap,
  });

  final int day;
  final bool faded;
  final bool isToday;
  final bool hasActivity;
  final bool isSelected;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final showHighlight = isSelected && !isToday;
    final textColor = faded
        ? context.colors.textSecondary.withValues(alpha: 0.35)
        : (isToday || isSelected)
        ? AppColors.textOnPrimary
        : context.colors.textPrimary;

    final label = [
      '$day',
      if (isToday) '(today)',
      if (hasActivity) '(has activities)',
      if (isSelected) '(selected)',
    ].join(' ');

    return Semantics(
      button: !faded,
      label: label,
      selected: isSelected,
      excludeSemantics: faded,
      child: PressableScale(
        onTap: faded ? null : onTap,
        child: SizedBox(
          width: 40,
          height: 40,
          child: Stack(
            alignment: Alignment.center,
            children: [
              if (isToday || showHighlight)
                Container(
                  width: 32,
                  height: 32,
                  decoration: BoxDecoration(
                    color: isToday
                        ? AppColors.primary
                        : context.colors.primarySoft,
                    shape: BoxShape.circle,
                  ),
                ),
              Text(
                '$day',
                style: AppTypography.labelField(context).copyWith(
                  fontWeight: (isToday || isSelected)
                      ? FontWeight.w700
                      : FontWeight.w500,
                  color: isSelected && !isToday
                      ? context.colors.primaryOnSurface
                      : textColor,
                ),
              ),
              // Event dot always renders when the day has events.
              if (hasActivity)
                Positioned(
                  bottom: 4,
                  child: Container(
                    width: 4,
                    height: 4,
                    decoration: BoxDecoration(
                      color: isToday
                          ? AppColors.textOnPrimary
                          : context.colors.primaryOnSurface,
                      shape: BoxShape.circle,
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class _ScheduleHeader extends StatelessWidget {
  const _ScheduleHeader({required this.label, required this.count});
  final String label;
  final int count;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Expanded(
          child: Text(
            label,
            style: AppTypography.titleMedium(context),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
        ),
        if (count > 0) ...[
          const SizedBox(width: AppSpacing.x2),
          Text(
            '$count ${count == 1 ? 'activity' : 'activities'}',
            style: AppTypography.chipLabel(
              context,
            ).copyWith(fontSize: 12, color: context.colors.primaryOnSurface),
          ),
        ],
      ],
    );
  }
}

class _EventCard extends ConsumerWidget {
  const _EventCard({required this.event});
  final CalendarEvent event;

  /// Hosted games manage from the host screen, past games from the review screen, everything else from the joined.
  String get _destination {
    if (event.isHost) return '/manage-activity/${event.activityId}';
    if (event.isPast) return '/past-activity/${event.activityId}/review';
    return '/joined-activity/${event.activityId}';
  }

  /// Writes this event to the OS calendar and reports the outcome.
  Future<void> _syncToDevice(BuildContext context, WidgetRef ref) async {
    final ok = await ref
        .read(calendarRepositoryProvider)
        .addToDeviceCalendar(event);
    ref.invalidate(_upcomingEventsProvider);
    if (!context.mounted) return;
    AppSnackbar.show(
      context,
      message: ok
          ? 'Added to your device calendar.'
          : 'Could not add to your device calendar.',
      variant: ok ? AppSnackbarVariant.success : AppSnackbarVariant.error,
    );
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final timeFmt = DateFormat('h:mm a');

    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.x2 + 2),
      child: Container(
        padding: const EdgeInsets.all(AppSpacing.x3),
        decoration: BoxDecoration(
          color: context.colors.surface,
          borderRadius: BorderRadius.circular(AppRadius.card),
          border: Border.all(color: context.colors.border),
        ),
        child: Row(
          children: [
            Expanded(
              child: Semantics(
                button: true,
                label: event.title,
                child: PressableScale(
                  onTap: () => NavGuard.push(context, _destination),
                  child: Row(
                    children: [
                      Container(
                        width: 40,
                        height: 40,
                        decoration: BoxDecoration(
                          color: context.colors.primaryLight,
                          borderRadius: BorderRadius.circular(AppRadius.md),
                        ),
                        alignment: Alignment.center,
                        child: AppIcon(
                          AppIcons.calendar2,
                          size: AppIconSize.lg,
                          color: context.colors.primaryOnSurface,
                        ),
                      ),
                      const SizedBox(width: AppSpacing.x3),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              event.title,
                              style: AppTypography.labelField(context),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                            const SizedBox(height: 4),
                            Row(
                              children: [
                                const AppIcon(
                                  AppIcons.clock,
                                  size: AppIconSize.sm,
                                ),
                                const SizedBox(width: AppSpacing.x1),
                                Text(
                                  timeFmt.format(event.start),
                                  style: AppTypography.caption(context),
                                ),
                                const SizedBox(width: AppSpacing.x2),
                                const AppIcon(
                                  AppIcons.mapPin,
                                  size: AppIconSize.sm,
                                ),
                                const SizedBox(width: AppSpacing.x1),
                                Expanded(
                                  child: Text(
                                    event.location,
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: AppTypography.caption(context),
                                  ),
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),
                      const AppIcon(
                        AppIcons.chevronRight,
                        size: AppIconSize.sm,
                      ),
                    ],
                  ),
                ),
              ),
            ),
            const SizedBox(width: AppSpacing.x1),
            // Device-calendar sync lives OUTSIDE the navigation tap target so syncing never also pushes the detail.
            Semantics(
              button: true,
              label: 'Sync ke kalender perangkat',
              child: IconButton(
                tooltip: 'Sync ke kalender perangkat',
                icon: Icon(
                  event.addedToDeviceCalendar
                      ? Icons.event_available_rounded
                      : Icons.event_rounded,
                  size: 22,
                  color: event.addedToDeviceCalendar
                      ? context.colors.primaryOnSurface
                      : context.colors.textSecondary,
                ),
                onPressed: event.addedToDeviceCalendar
                    ? null
                    : () => _syncToDevice(context, ref),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
