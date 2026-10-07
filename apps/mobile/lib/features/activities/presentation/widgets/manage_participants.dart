part of '../manage_activity_screen.dart';

class _ParticipantsSection extends StatelessWidget {
  const _ParticipantsSection({
    required this.activityId,
    required this.roster,
    required this.canKick,
    required this.kicking,
    required this.onKick,
  });
  final String activityId;
  final List<ActivityParticipant> roster;

  /// False on terminal lifecycles (cancelled/completed/removed) — no Remove buttons are rendered at all.
  final bool canKick;

  /// Uids with a kick in flight — their Remove buttons render disabled.
  final Set<String> kicking;

  /// `onKick(uid, displayName)`.
  final void Function(String uid, String name) onKick;

  @override
  Widget build(BuildContext context) {
    final preview = roster.take(3).toList();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(
              child: Text(
                'Participants (${roster.length})',
                style: AppTypography.titleMedium(context),
              ),
            ),
            AppTappable(
              semanticLabel: 'View all participants',
              feedback: AppTapFeedback.scale,
              minSize: 0,
              onTap: () =>
                  NavGuard.push(context, '/activity/$activityId/participants'),
              child: Text(
                'View all',
                style: AppTypography.chipLabel(
                  context,
                ).copyWith(color: context.colors.primaryOnSurface),
              ),
            ),
          ],
        ),
        const SizedBox(height: AppSpacing.x3),
        if (roster.isEmpty)
          Text('No participants yet', style: AppTypography.metaSub(context))
        else
          Container(
            decoration: BoxDecoration(
              color: context.colors.surface,
              borderRadius: BorderRadius.circular(AppRadius.card),
              border: Border.all(color: context.colors.border),
              boxShadow: AppShadows.card,
            ),
            child: Column(
              children: [
                for (var i = 0; i < preview.length; i++) ...[
                  _ParticipantRow(
                    item: preview[i],
                    canKick: canKick,
                    kicking: kicking.contains(preview[i].userId),
                    onKick: () => onKick(preview[i].userId, preview[i].name),
                  ),
                  if (i < preview.length - 1)
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

class _ParticipantRow extends StatelessWidget {
  const _ParticipantRow({
    required this.item,
    required this.canKick,
    required this.kicking,
    required this.onKick,
  });
  final ActivityParticipant item;

  /// Whether the host may kick this row. The organizer (host) row never renders Remove even when true.
  final bool canKick;

  /// True while this row's kick is in flight — the button renders disabled with a spinner.
  final bool kicking;
  final VoidCallback onKick;

  @override
  Widget build(BuildContext context) {
    // The host can't kick themselves — and kicking is meaningless on terminal games.
    final showRemove = canKick && !item.isOrganizer;
    return Padding(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.x4,
        vertical: AppSpacing.x3,
      ),
      child: Row(
        children: [
          AppAvatar(
            imageUrl: item.avatarUrl,
            name: item.name,
            size: AppAvatarSize.sm,
          ),
          const SizedBox(width: AppSpacing.x3),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(item.name, style: AppTypography.labelField(context)),
                Text(
                  item.isOrganizer
                      ? 'Host · ${item.skillLevel}'
                      : item.skillLevel,
                  style: AppTypography.metaSub(context),
                ),
              ],
            ),
          ),
          Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              StatusBadge(
                // "PENDING" used to mean "not checked in", which reads as "waiting approval".
                label: item.isCheckedIn ? 'CHECKED IN' : 'JOINED',
                tone: item.isCheckedIn
                    ? StatusTone.checkedIn
                    : StatusTone.pending,
              ),
              if (showRemove) ...[
                const SizedBox(height: 4),
                _RemoveButton(kicking: kicking, onKick: onKick),
              ],
            ],
          ),
        ],
      ),
    );
  }
}

/// Host-only "Remove" link under a roster row's status badge.

/// Host-only "Remove" link under a roster row's status badge.
class _RemoveButton extends StatelessWidget {
  const _RemoveButton({required this.kicking, required this.onKick});
  final bool kicking;
  final VoidCallback onKick;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      enabled: !kicking,
      label: 'Remove participant',
      child: PressableScale(
        onTap: kicking ? null : onKick,
        child: Opacity(
          opacity: kicking ? 0.45 : 1,
          child: SizedBox(
            height: 28,
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                if (kicking)
                  const SizedBox(
                    width: 12,
                    height: 12,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                else
                  Icon(
                    Icons.person_remove_outlined,
                    size: 14,
                    color: context.colors.errorText,
                  ),
                const SizedBox(width: 4),
                Text(
                  kicking ? 'Removing…' : 'Remove',
                  style: AppTypography.metaSub(context).copyWith(
                    color: context.colors.errorText,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

// Join requests section.

/// Hint shown when the request queue is empty so the section doesn't vanish without explanation.

/// Hint shown when the request queue is empty so the section doesn't vanish without explanation.
class _EmptyRequestsHint extends StatelessWidget {
  const _EmptyRequestsHint({required this.isApproval});
  final bool isApproval;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('Join requests', style: AppTypography.titleMedium(context)),
        const SizedBox(height: AppSpacing.x3),
        Container(
          width: double.infinity,
          padding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.x4,
            vertical: AppSpacing.x3,
          ),
          decoration: BoxDecoration(
            color: context.colors.surface,
            borderRadius: BorderRadius.circular(AppRadius.card),
            border: Border.all(color: context.colors.border),
            boxShadow: AppShadows.card,
          ),
          child: Text(
            isApproval
                ? 'No pending requests'
                : 'Open activity — new joins appear here',
            style: AppTypography.metaSub(context),
          ),
        ),
      ],
    );
  }
}

/// Pending join requests on approval-gated activities (host view).

/// Pending join requests on approval-gated activities (host view).
class _JoinRequestsSection extends StatelessWidget {
  const _JoinRequestsSection({
    required this.requests,
    required this.deciding,
    required this.onApprove,
    required this.onDecline,
  });

  final List<ActivityParticipant> requests;

  /// Uids with a decision in flight — their rows render disabled.
  final Set<String> deciding;
  final ValueChanged<ActivityParticipant> onApprove;
  final ValueChanged<ActivityParticipant> onDecline;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(
              child: Text(
                'Join requests (${requests.length})',
                style: AppTypography.titleMedium(context),
              ),
            ),
            StatusBadge(label: 'ACTION NEEDED', tone: StatusTone.pending),
          ],
        ),
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
              for (var i = 0; i < requests.length; i++) ...[
                _JoinRequestRow(
                  item: requests[i],
                  busy: deciding.contains(requests[i].userId),
                  onApprove: () => onApprove(requests[i]),
                  onDecline: () => onDecline(requests[i]),
                ),
                if (i < requests.length - 1)
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

class _JoinRequestRow extends StatelessWidget {
  const _JoinRequestRow({
    required this.item,
    required this.onApprove,
    required this.onDecline,
    this.busy = false,
  });

  final ActivityParticipant item;
  final VoidCallback onApprove;
  final VoidCallback onDecline;

  /// True while this row's approve/decline is in flight — both buttons are disabled until the decision settles.
  final bool busy;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.x4,
        vertical: AppSpacing.x3,
      ),
      child: Row(
        children: [
          Expanded(
            child: AppTappable(
              semanticLabel: 'View ${item.name} profile',
              feedback: AppTapFeedback.scale,
              // pushOnce guard (duplicate page keys red-screen).
              onTap: () => NavGuard.push(
                context,
                item.userId.isNotEmpty
                    ? '/player-profile/uid/${item.userId}'
                    : '/player-profile/${item.name}',
              ),
              child: Row(
                children: [
                  AppAvatar(
                    imageUrl: item.avatarUrl,
                    name: item.name,
                    size: AppAvatarSize.sm,
                  ),
                  const SizedBox(width: AppSpacing.x3),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          item.name,
                          style: AppTypography.labelField(context),
                        ),
                        Text(
                          item.skillLevel,
                          style: AppTypography.metaSub(context),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
          AppTappable(
            semanticLabel: 'Decline ${item.name}',
            feedback: AppTapFeedback.scale,
            minSize: 0,
            onTap: busy ? null : onDecline,
            child: Container(
              padding: const EdgeInsets.symmetric(
                horizontal: AppSpacing.x3,
                vertical: AppSpacing.x2,
              ),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(AppRadius.pill),
                border: Border.all(color: context.colors.border),
              ),
              child: Text(
                'Decline',
                style: AppTypography.chipLabel(
                  context,
                ).copyWith(color: context.colors.textSecondary),
              ),
            ),
          ),
          const SizedBox(width: AppSpacing.x2),
          AppTappable(
            semanticLabel: 'Approve ${item.name}',
            feedback: AppTapFeedback.scale,
            minSize: 0,
            onTap: busy ? null : onApprove,
            child: Container(
              padding: const EdgeInsets.symmetric(
                horizontal: AppSpacing.x3,
                vertical: AppSpacing.x2,
              ),
              decoration: BoxDecoration(
                color: busy ? context.colors.border : AppColors.primary,
                borderRadius: BorderRadius.circular(AppRadius.pill),
              ),
              child: busy
                  ? const SizedBox(
                      width: 16,
                      height: 16,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : Text(
                      'Approve',
                      style: AppTypography.chipLabel(
                        context,
                      ).copyWith(color: AppColors.textOnPrimary),
                    ),
            ),
          ),
        ],
      ),
    );
  }
}

// Details section.
