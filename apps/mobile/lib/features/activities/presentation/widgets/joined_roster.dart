part of '../joined_activity_detail_screen.dart';

class _ParticipantsSection extends ConsumerWidget {
  const _ParticipantsSection({required this.activity});
  final ActivityModel activity;

  static const double _size = 32;
  static const double _step = 22;
  static const int _maxVisible = 4;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final count = activity.participantCount;
    final roster = ref.watch(_rosterProvider(activity.id));

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
              '$count joined / ${activity.capacity} total',
              style: AppTypography.countAccent(context),
            ),
          ],
        ),
        const SizedBox(height: AppSpacing.x3),
        roster.when(
          loading: () => SizedBox(
            height: _size,
            child: Align(
              alignment: Alignment.centerLeft,
              child: SizedBox(
                width: 20,
                height: 20,
                child: CircularProgressIndicator(
                  strokeWidth: 2,
                  color: context.colors.primaryOnSurface,
                ),
              ),
            ),
          ),
          error: (_, _) => ErrorRetry(
            message: 'Could not load participants.',
            onRetry: () => ref.invalidate(_rosterProvider(activity.id)),
          ),
          data: (members) {
            if (members.isEmpty) {
              return Text(
                'No one has joined yet.',
                style: AppTypography.metaSub(context),
              );
            }
            final visible = members.take(_maxVisible).toList();
            final overflow = members.length - visible.length;
            final slots = visible.length + (overflow > 0 ? 1 : 0);
            // Visual facepile only — one "View roster" button below is the single entry point to the full.
            return Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                SizedBox(
                  // Keyed so tests can scope finders to the live roster stack.
                  key: const ValueKey('participant-stack'),
                  height: _size,
                  width: _step * (slots - 1) + _size,
                  child: Stack(
                    children: [
                      for (var i = 0; i < visible.length; i++)
                        Positioned(
                          left: i * _step,
                          child: _Ring(
                            child: AppAvatar(
                              imageUrl: visible[i].avatarUrl,
                              name: visible[i].name,
                              size: AppAvatarSize.sm,
                            ),
                          ),
                        ),
                      if (overflow > 0)
                        Positioned(
                          left: visible.length * _step,
                          child: _Ring(
                            child: ColoredBox(
                              color: context.colors.border,
                              child: Center(
                                child: Text(
                                  '+$overflow',
                                  style: AppTypography.badgeSport(context)
                                      .copyWith(
                                        color: context.colors.textSecondary,
                                      ),
                                ),
                              ),
                            ),
                          ),
                        ),
                    ],
                  ),
                ),
                const SizedBox(height: AppSpacing.x3),
                AppButton.secondary(
                  label: 'View roster · ${members.length} joined',
                  size: AppButtonSize.sm,
                  onPressed: () => NavGuard.push(
                    context,
                    '/activity/${activity.id}/participants',
                  ),
                ),
              ],
            );
          },
        ),
      ],
    );
  }
}

class _Ring extends StatelessWidget {
  const _Ring({required this.child});
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: _ParticipantsSection._size,
      height: _ParticipantsSection._size,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        border: Border.all(color: context.colors.surface, width: 2),
      ),
      child: ClipOval(child: child),
    );
  }
}

// Chat section.
