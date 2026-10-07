part of '../manage_activity_screen.dart';

class _ShareSheet extends StatelessWidget {
  const _ShareSheet({required this.activity});
  final ActivityModel activity;

  @override
  Widget build(BuildContext context) {
    final link = 'matchup.app/activity/${activity.id}';

    return Container(
      decoration: BoxDecoration(
        color: context.colors.surface,
        borderRadius: const BorderRadius.vertical(
          top: Radius.circular(AppRadius.xl),
        ),
      ),
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.x5,
        AppSpacing.x3,
        AppSpacing.x5,
        AppSpacing.x6,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Center(
            child: Container(
              width: 36,
              height: 4,
              margin: const EdgeInsets.only(bottom: AppSpacing.x4),
              decoration: BoxDecoration(
                color: context.colors.border,
                borderRadius: BorderRadius.circular(AppRadius.pill),
              ),
            ),
          ),
          Text('Share Activity', style: AppTypography.titleSheet(context)),
          const SizedBox(height: AppSpacing.x2),
          Text(
            activity.title,
            style: AppTypography.metaSub(context),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
          const SizedBox(height: AppSpacing.x4),

          // Link card
          Container(
            padding: const EdgeInsets.all(AppSpacing.x4),
            decoration: BoxDecoration(
              color: context.colors.surfaceMuted,
              borderRadius: BorderRadius.circular(AppRadius.card),
              border: Border.all(color: context.colors.border),
            ),
            child: Row(
              children: [
                Expanded(
                  child: Text(
                    link,
                    style: AppTypography.metaSub(
                      context,
                    ).copyWith(fontWeight: FontWeight.w600),
                  ),
                ),
                AppTappable(
                  semanticLabel: 'Copy link',
                  feedback: AppTapFeedback.scale,
                  minSize: 36,
                  onTap: () {
                    Clipboard.setData(ClipboardData(text: link));
                    AppSnackbar.show(
                      context,
                      message: 'Link copied.',
                      variant: AppSnackbarVariant.success,
                    );
                    Navigator.of(context).pop();
                  },
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: AppSpacing.x3,
                      vertical: 6,
                    ),
                    decoration: BoxDecoration(
                      color: context.colors.primarySoft,
                      borderRadius: BorderRadius.circular(AppRadius.pill),
                    ),
                    child: Text(
                      'Copy',
                      style: AppTypography.chipLabel(context).copyWith(
                        color: context.colors.primaryOnSurface,
                        fontSize: 12,
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: AppSpacing.x4),

          // Share options
          Row(
            children: [
              _ShareOption(
                icon: Icons.message_rounded,
                label: 'Message',
                color: context.colors.successText,
                bgColor: context.colors.statusSuccessBg,
                onTap: () {
                  Navigator.of(context).pop();
                  NavGuard.push(context, '/chat/${activity.id}');
                },
              ),
              const SizedBox(width: AppSpacing.x3),
              _ShareOption(
                icon: Icons.link_rounded,
                label: 'Copy link',
                color: context.colors.primaryOnSurface,
                bgColor: context.colors.primarySoft,
                onTap: () {
                  Clipboard.setData(ClipboardData(text: link));
                  AppSnackbar.show(
                    context,
                    message: 'Link copied.',
                    variant: AppSnackbarVariant.success,
                  );
                  Navigator.of(context).pop();
                },
              ),
              const SizedBox(width: AppSpacing.x3),
              _ShareOption(
                icon: Icons.ios_share_rounded,
                label: 'More',
                color: context.colors.textPrimary,
                bgColor: context.colors.surfaceSubtle,
                onTap: () {
                  Navigator.of(context).pop();
                  ShareHelper.shareActivity(activity);
                },
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _ShareOption extends StatelessWidget {
  const _ShareOption({
    required this.icon,
    required this.label,
    required this.color,
    required this.bgColor,
    required this.onTap,
  });
  final IconData icon;
  final String label;
  final Color color;
  final Color bgColor;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return AppTappable(
      semanticLabel: label,
      feedback: AppTapFeedback.scale,
      minSize: 0,
      onTap: onTap,
      child: Column(
        children: [
          Container(
            width: 56,
            height: 56,
            decoration: BoxDecoration(
              color: bgColor,
              borderRadius: BorderRadius.circular(AppRadius.card),
              border: Border.all(color: context.colors.border),
            ),
            alignment: Alignment.center,
            child: Icon(icon, size: 24, color: color),
          ),
          const SizedBox(height: AppSpacing.x1),
          Text(label, style: AppTypography.caption(context)),
        ],
      ),
    );
  }
}

// Announce sheet.
