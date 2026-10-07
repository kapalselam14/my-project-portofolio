part of '../chat_screen.dart';

class _MatchBanner extends StatefulWidget {
  const _MatchBanner({required this.activityAsync, required this.onRetry});
  final AsyncValue<ActivityModel?> activityAsync;
  final VoidCallback onRetry;

  /// Check-in window shared with the check-in screen: opens 30 minutes before start, closes at the activity end.
  static bool checkInOpen(DateTime now, DateTime start, DateTime end) {
    return !now.isBefore(start.subtract(const Duration(minutes: 30))) &&
        !now.isAfter(end);
  }

  @override
  State<_MatchBanner> createState() => _MatchBannerState();
}

class _MatchBannerState extends State<_MatchBanner> {
  Timer? _ticker;

  @override
  void initState() {
    super.initState();
    _ticker = Timer.periodic(const Duration(seconds: 30), (_) {
      if (mounted) setState(() {});
    });
  }

  @override
  void dispose() {
    _ticker?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final activity = widget.activityAsync.valueOrNull;
    final hasError = widget.activityAsync.hasError;
    final inWindow =
        activity != null &&
        _MatchBanner.checkInOpen(
          DateTime.now(),
          activity.dateTime,
          activity.endTime,
        );
    return Container(
      margin: const EdgeInsets.fromLTRB(
        AppSpacing.x4,
        AppSpacing.x3,
        AppSpacing.x4,
        AppSpacing.x2,
      ),
      padding: const EdgeInsets.all(AppSpacing.x4),
      decoration: BoxDecoration(
        color: context.colors.surface,
        borderRadius: BorderRadius.circular(AppRadius.card),
        border: Border.all(color: context.colors.border),
        boxShadow: AppShadows.card,
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Day badge — TODAY when the game is today.
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: AppSpacing.x3,
                    vertical: 4,
                  ),
                  decoration: BoxDecoration(
                    color: AppColors.primary,
                    borderRadius: BorderRadius.circular(AppRadius.pill),
                  ),
                  child: Text(
                    activity == null
                        ? '···'
                        : _bannerDayLabel(activity.dateTime),
                    style: AppTypography.badgeSport(context).copyWith(
                      color: AppColors.textOnPrimary,
                      letterSpacing: 0.5,
                    ),
                  ),
                ),
                const SizedBox(height: AppSpacing.x2),
                Text(
                  activity?.location ?? 'Chat',
                  style: AppTypography.titleMedium(context),
                ),
                const SizedBox(height: 2),
                if (hasError && activity == null)
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          'Could not load details',
                          style: AppTypography.metaSub(context),
                        ),
                      ),
                      TextButton(
                        onPressed: widget.onRetry,
                        child: const Text('Retry'),
                      ),
                    ],
                  )
                else
                  Text(
                    activity == null
                        ? 'Loading details…'
                        : _bannerKickoffLabel(activity.dateTime),
                    style: AppTypography.metaSub(context),
                  ),
              ],
            ),
          ),
          const SizedBox(width: AppSpacing.x3),

          // Check In button — only inside the check-in window.
          if (activity != null && inWindow)
            Semantics(
              button: true,
              label: 'Check in to this activity',
              child: PressableScale(
                onTap: () => NavGuard.push(context, '/check-in/${activity.id}'),
                child: Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: AppSpacing.x4,
                    vertical: AppSpacing.x3,
                  ),
                  decoration: BoxDecoration(
                    color: AppColors.primary,
                    borderRadius: BorderRadius.circular(AppRadius.card),
                    boxShadow: AppShadows.glowPrimary,
                  ),
                  child: Text(
                    'Check In',
                    style: AppTypography.buttonPrimary.copyWith(fontSize: 15),
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

/// 'TODAY' when [dateTime] is today, otherwise the 3-letter weekday.
String _bannerDayLabel(DateTime? dateTime) {
  if (dateTime == null) return 'TODAY';
  final now = DateTime.now();
  if (now.year == dateTime.year &&
      now.month == dateTime.month &&
      now.day == dateTime.day) {
    return 'TODAY';
  }
  const days = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
  return days[(dateTime.weekday - 1) % 7];
}

/// 'Kickoff at 5:30 PM' without pulling in intl for one label.
String _bannerKickoffLabel(DateTime dateTime) {
  final h24 = dateTime.hour;
  final h = h24 % 12 == 0 ? 12 : h24 % 12;
  final m = dateTime.minute.toString().padLeft(2, '0');
  final ap = h24 < 12 ? 'AM' : 'PM';
  return 'Kickoff at $h:$m $ap';
}

// Message list.
