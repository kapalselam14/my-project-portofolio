part of '../manage_activity_screen.dart';

class _DetailsSection extends StatelessWidget {
  const _DetailsSection({required this.activity});
  final ActivityModel activity;

  @override
  Widget build(BuildContext context) {
    final rows = [
      ('Max Players', '${activity.capacity} players'),
      ('Skill Level', activity.skillLevel),
      ('Location', activity.location),
      ('Duration', activity.durationLabel),
    ];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('Activity details', style: AppTypography.titleMedium(context)),
        const SizedBox(height: AppSpacing.x3),
        Container(
          decoration: BoxDecoration(
            color: context.colors.surface,
            borderRadius: BorderRadius.circular(AppRadius.card),
            border: Border.all(color: context.colors.border),
            boxShadow: AppShadows.card,
          ),
          child: Column(
            children: [
              for (var i = 0; i < rows.length; i++) ...[
                Padding(
                  padding: const EdgeInsets.symmetric(
                    horizontal: AppSpacing.x4,
                    vertical: AppSpacing.x3,
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        rows[i].$1,
                        style: AppTypography.metaSub(
                          context,
                        ).copyWith(fontWeight: FontWeight.w500),
                      ),
                      Text(
                        rows[i].$2,
                        style: AppTypography.labelField(context),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ),
                ),
                if (i < rows.length - 1)
                  Divider(
                    height: 1,
                    color: context.colors.border,
                    indent: AppSpacing.x4,
                    endIndent: AppSpacing.x4,
                  ),
              ],
            ],
          ),
        ),
      ],
    );
  }
}

// Cancel button.

class _CancelButton extends StatelessWidget {
  const _CancelButton({required this.onTap});
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return PressableScale(
      onTap: onTap,
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.symmetric(vertical: AppSpacing.x3 + 2),
        decoration: BoxDecoration(
          color: context.colors.surface,
          borderRadius: BorderRadius.circular(AppRadius.pill),
          border: Border.all(color: context.colors.errorText, width: 1.5),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              Icons.delete_outline_rounded,
              size: 18,
              color: context.colors.errorText,
            ),
            const SizedBox(width: AppSpacing.x2),
            Text(
              'Cancel Activity',
              style: AppTypography.labelField(
                context,
              ).copyWith(color: context.colors.errorText, fontSize: 15),
            ),
          ],
        ),
      ),
    );
  }
}

// Complete button.

class _CompleteButton extends StatelessWidget {
  const _CompleteButton({required this.onTap});
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return PressableScale(
      onTap: onTap,
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.symmetric(vertical: AppSpacing.x3 + 2),
        decoration: BoxDecoration(
          color: context.colors.statusSuccessBg,
          borderRadius: BorderRadius.circular(AppRadius.pill),
          border: Border.all(color: context.colors.successText, width: 1.5),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              Icons.check_circle_outline_rounded,
              size: 18,
              color: context.colors.successText,
            ),
            const SizedBox(width: AppSpacing.x2),
            Text(
              'Mark as Completed',
              style: AppTypography.labelField(
                context,
              ).copyWith(color: context.colors.successText, fontSize: 15),
            ),
          ],
        ),
      ),
    );
  }
}
