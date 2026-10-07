part of '../chat_screen.dart';

class _ChatSettingsSheet extends StatefulWidget {
  const _ChatSettingsSheet({
    required this.activityId,
    required this.activityTitle,
    this.activity,
  });
  final String activityId;
  final String activityTitle;

  /// Viewer-context snapshot for routing "View activity details" (host → manage, participant → joined, past → review).
  final ActivityModel? activity;

  static Future<void> show(
    BuildContext context, {
    required String activityId,
    required String activityTitle,
    ActivityModel? activity,
  }) {
    return showModalBottomSheet<void>(
      context: context,
      useSafeArea: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _ChatSettingsSheet(
        activityId: activityId,
        activityTitle: activityTitle,
        activity: activity,
      ),
    );
  }

  @override
  State<_ChatSettingsSheet> createState() => _ChatSettingsSheetState();
}

class _ChatSettingsSheetState extends State<_ChatSettingsSheet> {
  /// Null while the persisted value loads — the row hides until then so a stale default never flashes.
  bool? _muted;

  @override
  void initState() {
    super.initState();
    isChatMuted(widget.activityId).then((muted) {
      if (mounted) setState(() => _muted = muted);
    });
  }

  Future<void> _toggleMute() async {
    final next = !(_muted ?? false);
    setState(() => _muted = next);
    await setChatMuted(widget.activityId, next);
  }

  @override
  Widget build(BuildContext context) {
    final muted = _muted ?? false;
    final isHost = widget.activity?.isHost ?? false;
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
          _SettingsRow(
            icon: isHost
                ? Icons.settings_suggest_outlined
                : Icons.info_outline_rounded,
            label: isHost ? 'Manage activity' : 'View activity details',
            onTap: () {
              Navigator.of(context).pop();
              NavGuard.push(
                context,
                _detailsRoute(widget.activity, widget.activityId),
              );
            },
          ),
          _SettingsRow(
            icon: Icons.photo_library_outlined,
            label: 'Photo moments',
            onTap: () {
              Navigator.of(context).pop();
              NavGuard.push(context, '/chat/${widget.activityId}/moments');
            },
          ),
          if (_muted != null)
            _SettingsRow(
              icon: muted
                  ? Icons.notifications_off_outlined
                  : Icons.notifications_outlined,
              label: muted ? 'Unmute this chat' : 'Mute this chat',
              onTap: _toggleMute,
            ),
          _SettingsRow(
            icon: Icons.flag_outlined,
            label: 'Report activity',
            onTap: () {
              Navigator.of(context).pop();
              ReportActivitySheet.show(
                context,
                activityId: widget.activityId,
                activityTitle: widget.activityTitle,
              );
            },
          ),
        ],
      ),
    );
  }
}

class _SettingsRow extends StatelessWidget {
  const _SettingsRow({
    required this.icon,
    required this.label,
    required this.onTap,
  });
  final IconData icon;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return PressableScale(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: AppSpacing.x3),
        child: Row(
          children: [
            Icon(icon, size: 20, color: context.colors.textPrimary),
            const SizedBox(width: AppSpacing.x4),
            Text(label, style: AppTypography.titleMedium(context)),
          ],
        ),
      ),
    );
  }
}
