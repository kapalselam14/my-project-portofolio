part of '../activity_detail_screen.dart';

class _ReportButton extends StatelessWidget {
  const _ReportButton({required this.activity});
  final ActivityModel activity;

  @override
  Widget build(BuildContext context) {
    return PressableScale(
      onTap: () => ReportActivitySheet.show(
        context,
        activityId: activity.id,
        activityTitle: activity.title,
      ),
      child: Container(
        height: 44,
        decoration: BoxDecoration(
          color: context.colors.surfaceSubtle,
          borderRadius: BorderRadius.circular(AppRadius.input),
          border: Border.all(color: context.colors.border),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            AppIcon(
              AppIcons.alertCircle,
              size: AppIconSize.lg,
              color: context.colors.errorText,
            ),
            const SizedBox(width: 8),
            Text(
              'Report Activity',
              style: AppTypography.labelField(
                context,
              ).copyWith(color: context.colors.errorText),
            ),
          ],
        ),
      ),
    );
  }
}

// Action bar.

class _ActionBar extends StatelessWidget {
  const _ActionBar({
    required this.activity,
    required this.joining,
    required this.requestPending,
    required this.onDislike,
    required this.onJoin,
  });
  final ActivityModel activity;
  final bool joining;

  /// A sent-but-undecided join request.
  final bool requestPending;
  final VoidCallback onDislike;
  final VoidCallback onJoin;

  @override
  Widget build(BuildContext context) {
    final canJoin =
        !activity.isFull && !requestPending && !activity.hasStarted && !joining;
    final joinLabel = requestPending
        ? 'Request pending'
        : activity.hasStarted
        ? 'Already started'
        : activity.requiresApproval
        ? 'Request to Join'
        : (canJoin ? 'Join Game' : 'Activity Full');

    // Why the pill is disabled — surfaced on tap instead of a dead tap.
    String? disabledReason() {
      if (requestPending) return 'Your request is pending host approval.';
      if (activity.hasStarted) return 'This activity has already started.';
      if (activity.isFull) return 'This activity is full.';
      return null;
    }

    return Container(
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.x5,
        AppSpacing.x3,
        AppSpacing.x5,
        AppSpacing.x3,
      ),
      decoration: BoxDecoration(
        color: context.colors.surface,
        boxShadow: AppShadows.bottomBar,
      ),
      child: Row(
        children: [
          // Small dismiss circle button on the left
          Semantics(
            button: true,
            label: 'Not interested',
            child: PressableScale(
              onTap: onDislike,
              child: Container(
                width: 52,
                height: 52,
                decoration: BoxDecoration(
                  color: context.colors.surface,
                  shape: BoxShape.circle,
                  border: Border.all(color: context.colors.border),
                  boxShadow: AppShadows.card,
                ),
                alignment: Alignment.center,
                child: Icon(
                  Icons.close_rounded,
                  size: 22,
                  color: context.colors.textSecondary,
                ),
              ),
            ),
          ),
          const SizedBox(width: AppSpacing.x3),

          // Full-width Join Game pill button
          Expanded(
            child: Semantics(
              button: true,
              label: requestPending
                  ? 'Join request pending'
                  : (activity.hasStarted
                        ? 'Activity already started'
                        : (canJoin ? 'Join Game' : 'Activity is full')),
              child: PressableScale(
                // Disabled pills still explain themselves on tap (full / started / pending).
                onTap: canJoin
                    ? onJoin
                    : (joining
                          ? null
                          : () {
                              final reason = disabledReason();
                              if (reason == null) return;
                              AppSnackbar.show(
                                context,
                                message: reason,
                                variant: AppSnackbarVariant.info,
                              );
                            }),
                child: Container(
                  height: 56,
                  decoration: BoxDecoration(
                    color: canJoin ? AppColors.primary : context.colors.border,
                    borderRadius: BorderRadius.circular(AppRadius.pill),
                    boxShadow: canJoin ? AppShadows.glowPrimary : null,
                  ),
                  alignment: Alignment.center,
                  child: joining
                      ? const SizedBox(
                          width: 22,
                          height: 22,
                          child: CircularProgressIndicator(
                            valueColor: AlwaysStoppedAnimation<Color>(
                              AppColors.textOnPrimary,
                            ),
                            strokeWidth: 2.5,
                          ),
                        )
                      : Text(
                          joinLabel,
                          style: AppTypography.buttonPrimary.copyWith(
                            color: AppColors.textOnPrimary,
                          ),
                        ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
