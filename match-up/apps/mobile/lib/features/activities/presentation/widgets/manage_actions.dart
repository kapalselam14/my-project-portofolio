part of '../manage_activity_screen.dart';

class _QuickActions extends StatelessWidget {
  const _QuickActions({
    required this.activityId,
    required this.activity,
    required this.onEdit,
  });
  final String activityId;
  final ActivityModel activity;

  /// Opens the full-screen edit screen (no tab bar, ✕ to cancel).
  final VoidCallback onEdit;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('Quick actions', style: AppTypography.titleMedium(context)),
        const SizedBox(height: AppSpacing.x3),
        Row(
          children: [
            Expanded(
              child: _ActionBtn(
                icon: Icons.edit_outlined,
                label: 'Edit',
                iconColor: context.colors.primaryOnSurface,
                bgColor: context.colors.primarySoft,
                onTap: onEdit,
              ),
            ),
            Expanded(
              child: _ActionBtn(
                icon: Icons.share_outlined,
                label: 'Share',
                iconColor: context.colors.textPrimary,
                bgColor: context.colors.surfaceMuted,
                onTap: () => _showShareSheet(context),
              ),
            ),
            Expanded(
              child: _ActionBtn(
                icon: Icons.campaign_outlined,
                label: 'Announce',
                iconColor: context.colors.warningText,
                bgColor: context.colors.warningBg,
                onTap: () => _showAnnounceSheet(context),
              ),
            ),
            Expanded(
              child: _ActionBtn(
                icon: Icons.people_outline_rounded,
                label: 'Roster',
                iconColor: context.colors.textPrimary,
                bgColor: context.colors.surfaceMuted,
                onTap: () => NavGuard.push(
                  context,
                  '/activity/$activityId/participants',
                ),
              ),
            ),
            Expanded(
              child: _ActionBtn(
                icon: Icons.forum_outlined,
                label: 'Chat',
                iconColor: context.colors.primaryOnSurface,
                bgColor: context.colors.primarySoft,
                onTap: () => NavGuard.push(context, '/chat/$activityId'),
              ),
            ),
          ],
        ),
      ],
    );
  }

  void _showShareSheet(BuildContext context) {
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (_) => _ShareSheet(activity: activity),
    );
  }

  void _showAnnounceSheet(BuildContext context) {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _AnnounceSheet(activityId: activityId),
    );
  }
}

class _ActionBtn extends StatelessWidget {
  const _ActionBtn({
    required this.icon,
    required this.label,
    required this.iconColor,
    required this.bgColor,
    required this.onTap,
  });
  final IconData icon;
  final String label;
  final Color iconColor;
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
            width: 52,
            height: 52,
            decoration: BoxDecoration(
              color: bgColor,
              borderRadius: BorderRadius.circular(AppRadius.card),
              border: Border.all(color: context.colors.border),
            ),
            alignment: Alignment.center,
            child: Icon(icon, size: 22, color: iconColor),
          ),
          const SizedBox(height: AppSpacing.x2),
          Text(
            label,
            style: AppTypography.caption(context),
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }
}

// Share sheet.
