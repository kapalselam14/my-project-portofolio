part of '../dm_screen.dart';

/// Bottom sheet behind the DM header settings button: view the peer's profile or report them.
class _DmSettingsSheet extends StatelessWidget {
  const _DmSettingsSheet({required this.peerUid, required this.peerName});
  final String peerUid;
  final String peerName;

  static Future<void> show(
    BuildContext context, {
    required String peerUid,
    required String peerName,
  }) {
    return showModalBottomSheet<void>(
      context: context,
      useSafeArea: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _DmSettingsSheet(peerUid: peerUid, peerName: peerName),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.fromLTRB(
        AppSpacing.x5,
        AppSpacing.x3,
        AppSpacing.x5,
        AppSpacing.x5 + MediaQuery.of(context).viewPadding.bottom,
      ),
      decoration: BoxDecoration(
        color: context.colors.surface,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 36,
            height: 4,
            decoration: BoxDecoration(
              color: context.colors.border,
              borderRadius: BorderRadius.circular(2),
            ),
          ),
          const SizedBox(height: AppSpacing.x4),
          _DmSettingsRow(
            icon: Icons.person_outline_rounded,
            label: 'View profile',
            onTap: () {
              Navigator.of(context).pop();
              // Uid route: exact match, safe for any display name (spaces, slashes, duplicates).
              NavGuard.push(context, '/player-profile/uid/$peerUid');
            },
          ),
          _DmSettingsRow(
            icon: Icons.flag_outlined,
            label: 'Report $peerName',
            onTap: () {
              Navigator.of(context).pop();
              ReportUserSheet.show(
                context,
                userId: peerUid,
                userName: peerName,
              );
            },
          ),
        ],
      ),
    );
  }
}

class _DmSettingsRow extends StatelessWidget {
  const _DmSettingsRow({
    required this.icon,
    required this.label,
    required this.onTap,
  });
  final IconData icon;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: label,
      child: PressableScale(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: AppSpacing.x3),
          child: Row(
            children: [
              Icon(icon, size: 22, color: context.colors.textSecondary),
              const SizedBox(width: AppSpacing.x4),
              Expanded(
                child: Text(
                  label,
                  style: AppTypography.bodyMedium(context),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              Icon(
                Icons.arrow_forward_ios_rounded,
                size: 16,
                color: context.colors.textTertiary,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
