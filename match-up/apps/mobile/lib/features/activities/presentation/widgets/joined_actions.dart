part of '../joined_activity_detail_screen.dart';

class _AddToCalendarButton extends ConsumerStatefulWidget {
  const _AddToCalendarButton({required this.activity});
  final ActivityModel activity;

  @override
  ConsumerState<_AddToCalendarButton> createState() =>
      _AddToCalendarButtonState();
}

class _AddToCalendarButtonState extends ConsumerState<_AddToCalendarButton> {
  bool _added = false;
  bool _saving = false;

  Future<void> _add() async {
    if (_added || _saving) return;
    setState(() => _saving = true);
    try {
      final activity = widget.activity;
      final ok = await ref
          .read(calendarRepositoryProvider)
          .addToDeviceCalendar(
            CalendarEvent(
              id: activity.id,
              activityId: activity.id,
              title: activity.title,
              start: activity.dateTime,
              end: activity.endTime,
              location: activity.location,
            ),
          );
      if (!mounted) return;
      if (!ok) {
        setState(() => _saving = false);
        AppSnackbar.show(
          context,
          message: 'Could not add to calendar',
          variant: AppSnackbarVariant.error,
        );
        return;
      }
      setState(() {
        _saving = false;
        _added = true;
      });
      AppSnackbar.show(
        context,
        message: 'Added to calendar',
        variant: AppSnackbarVariant.success,
      );
    } catch (_) {
      if (!mounted) return;
      setState(() => _saving = false);
      AppSnackbar.show(
        context,
        message: 'Could not add to calendar',
        variant: AppSnackbarVariant.error,
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return PressableScale(
      onTap: _added ? null : _add,
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.symmetric(vertical: AppSpacing.x3 + 2),
        decoration: BoxDecoration(
          color: context.colors.surface,
          borderRadius: BorderRadius.circular(AppRadius.pill),
          border: Border.all(color: context.colors.border),
          boxShadow: AppShadows.card,
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            if (_saving)
              SizedBox(
                width: 18,
                height: 18,
                child: CircularProgressIndicator(
                  strokeWidth: 2,
                  color: context.colors.textPrimary,
                ),
              )
            else
              Icon(
                _added
                    ? Icons.check_circle_rounded
                    : Icons.calendar_month_outlined,
                size: 18,
                color: _added
                    ? context.colors.successText
                    : context.colors.textPrimary,
              ),
            const SizedBox(width: AppSpacing.x2),
            Text(
              _added ? 'Added to Calendar' : 'Add to Calendar',
              style: AppTypography.labelField(context),
            ),
          ],
        ),
      ),
    );
  }
}

class _CheckInButton extends StatelessWidget {
  const _CheckInButton({required this.activityId});
  final String activityId;

  @override
  Widget build(BuildContext context) {
    return PressableScale(
      onTap: () => NavGuard.push(context, '/check-in/$activityId'),
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.symmetric(vertical: AppSpacing.x3 + 2),
        decoration: BoxDecoration(
          color: AppColors.primary,
          borderRadius: BorderRadius.circular(AppRadius.pill),
          boxShadow: AppShadows.glowPrimary,
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(
              Icons.check_circle_outline_rounded,
              size: 18,
              color: AppColors.textOnPrimary,
            ),
            const SizedBox(width: AppSpacing.x2),
            Text(
              'Check In',
              style: AppTypography.buttonPrimary.copyWith(fontSize: 15),
            ),
          ],
        ),
      ),
    );
  }
}
