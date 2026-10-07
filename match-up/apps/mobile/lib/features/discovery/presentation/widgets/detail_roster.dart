part of '../activity_detail_screen.dart';

class _ParticipantsSection extends StatelessWidget {
  const _ParticipantsSection({required this.activity});
  final ActivityModel activity;

  @override
  Widget build(BuildContext context) {
    final waiting = activity.requiresApproval
        ? activity.pendingRequestCount
        : 0;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(
              child: Text(
                'Participants',
                style: AppTypography.titleMedium(context),
              ),
            ),
            Text(
              '${activity.participantCount} joined / ${activity.capacity} total',
              style: AppTypography.countAccent(context),
            ),
          ],
        ),
        if (waiting > 0) ...[
          const SizedBox(height: 2),
          Text(
            '$waiting waiting for approval',
            style: AppTypography.bodySmall(context).copyWith(
              color: context.colors.warningText,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
        const SizedBox(height: AppSpacing.x3),
        _ParticipantAvatars(activityId: activity.id),
      ],
    );
  }
}

/// Overlapping participant avatars with a `+N` overflow badge.
/// Faces come from the live roster (`activityRepository.participants`): backend photo when the user has one, initials.

/// Overlapping participant avatars with a `+N` overflow badge.
/// Faces come from the live roster (`activityRepository.participants`): backend photo when the user has one, initials.
class _ParticipantAvatars extends ConsumerWidget {
  const _ParticipantAvatars({required this.activityId});
  final String activityId;

  static const double _size = 32;
  static const double _step = 22;
  static const int _maxVisible = 4;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final roster = ref.watch(_rosterProvider(activityId));

    return roster.when(
      loading: () => const SkeletonBox(width: 160, height: 32, radius: 16),
      error: (_, _) => ErrorRetry(
        message: 'Could not load participants.',
        onRetry: () => ref.invalidate(_rosterProvider(activityId)),
      ),
      data: (members) {
        if (members.isEmpty) {
          return Text(
            'No one has joined yet',
            style: AppTypography.metaSub(context),
          );
        }
        final visible = members.take(_maxVisible).toList();
        final overflow = members.length - visible.length;
        return _AvatarStack(members: visible, overflow: overflow);
      },
    );
  }
}

/// Overlapping avatar row shared by the roster-backed stacks.

/// Overlapping avatar row shared by the roster-backed stacks.
class _AvatarStack extends StatelessWidget {
  const _AvatarStack({required this.members, required this.overflow});
  final List<ActivityParticipant> members;
  final int overflow;

  @override
  Widget build(BuildContext context) {
    final slots = members.length + (overflow > 0 ? 1 : 0);

    return SizedBox(
      height: _ParticipantAvatars._size,
      width:
          _ParticipantAvatars._step * (slots - 1) + _ParticipantAvatars._size,
      child: Stack(
        children: [
          for (var i = 0; i < members.length; i++)
            Positioned(
              left: i * _ParticipantAvatars._step,
              child: _Ring(
                child: AppAvatar(
                  imageUrl: members[i].avatarUrl,
                  name: members[i].name,
                  size: AppAvatarSize.sm,
                ),
              ),
            ),
          if (overflow > 0)
            Positioned(
              left: members.length * _ParticipantAvatars._step,
              child: _Ring(
                child: ColoredBox(
                  color: context.colors.border,
                  child: Center(
                    child: Text(
                      '+$overflow',
                      style: AppTypography.badgeSport(
                        context,
                      ).copyWith(color: context.colors.textSecondary),
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

class _Ring extends StatelessWidget {
  const _Ring({required this.child});
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: _ParticipantAvatars._size,
      height: _ParticipantAvatars._size,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        border: Border.all(color: context.colors.surface, width: 2),
      ),
      child: ClipOval(child: child),
    );
  }
}

// Report button.
