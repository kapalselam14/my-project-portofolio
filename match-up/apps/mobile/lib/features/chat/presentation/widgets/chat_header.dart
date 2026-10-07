part of '../chat_screen.dart';

class _Header extends ConsumerWidget {
  const _Header({required this.title, required this.activityId, this.activity});
  final String title;
  final String activityId;

  /// Viewer-context snapshot for routing "View activity details".
  final ActivityModel? activity;

  /// Maps a backend uid to a friendly display name.
  String _displayName(ActivityParticipant p) {
    final n = p.name.trim();
    if (n.isEmpty || n == p.userId) return p.userId;
    // First name only — "Alex Mercer" → "Alex"
    final first = n.split(RegExp(r'\s+')).first;
    return first.isEmpty ? n : first;
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // Exclude self from the typing poll — no "you are typing…" indicator needed.
    final myUid = ref.watch(_myUidProvider).valueOrNull;
    final otherUids = ref.watch(
      _chatOtherUidsProvider((activityId: activityId, myUid: myUid)),
    );
    final participants =
        ref.watch(_participantsProvider(activityId)).valueOrNull ??
        const <ActivityParticipant>[];

    // Watch the typing stream for the real participant uids.
    final typing =
        ref
            .watch(
              _typingUidsProvider((
                activityId: activityId,
                otherUids: otherUids,
              )),
            )
            .valueOrNull ??
        const <String>{};

    // Build a uid → name lookup from the roster so we can show "Alex is typing…" instead of "alex is typing…".
    final nameByUid = <String, String>{
      for (final p in participants)
        if (p.userId != myUid) p.userId: _displayName(p),
    };

    final subtitle = _buildSubtitle(typing, nameByUid, participants.length);

    // Navy header: brand gradient (same family as the splash) with two translucent glow circles so it reads as one.
    return Container(
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [_chatHeaderNavyTop, AppColors.primary],
        ),
        borderRadius: BorderRadius.vertical(
          bottom: Radius.circular(AppRadius.card),
        ),
      ),
      child: Stack(
        children: [
          // Decorative glows — splash motif, no asset dependency.
          Positioned(
            right: -32,
            top: -44,
            child: Container(
              width: 120,
              height: 120,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: Colors.white.withValues(alpha: 0.08),
              ),
            ),
          ),
          Positioned(
            left: 140,
            bottom: -56,
            child: Container(
              width: 100,
              height: 100,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: Colors.white.withValues(alpha: 0.06),
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(
              AppSpacing.x4,
              AppSpacing.x3,
              AppSpacing.x4,
              AppSpacing.x4,
            ),
            child: Row(
              children: [
                // Back button — frosted glass on navy
                _HeaderButton(
                  label: 'Back',
                  icon: Icons.arrow_back_ios_new_rounded,
                  iconSize: 16,
                  onTap: () => context.pop(),
                ),
                const SizedBox(width: AppSpacing.x3),

                // Title + members / typing
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        title,
                        style: AppTypography.titleSheet(
                          context,
                        ).copyWith(color: Colors.white),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      const SizedBox(height: 2),
                      AnimatedSwitcher(
                        duration: const Duration(milliseconds: 200),
                        child: Text(
                          subtitle,
                          key: ValueKey(subtitle),
                          style: typing.isNotEmpty
                              ? AppTypography.metaSub(context).copyWith(
                                  color: AppColors.accentLight,
                                  fontStyle: FontStyle.italic,
                                  fontWeight: FontWeight.w600,
                                )
                              : AppTypography.metaSub(context).copyWith(
                                  color: Colors.white.withValues(alpha: 0.75),
                                ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: AppSpacing.x3),

                // Settings button — frosted glass on navy
                _HeaderButton(
                  label: 'Chat settings',
                  icon: Icons.settings_outlined,
                  iconSize: 18,
                  onTap: () => _ChatSettingsSheet.show(
                    context,
                    activityId: activityId,
                    activityTitle: title,
                    activity: activity,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  /// Builds the subtitle string — either a "X is typing..." message or a static members line.
  String _buildSubtitle(
    Set<String> typing,
    Map<String, String> nameByUid,
    int totalParticipants,
  ) {
    if (typing.isNotEmpty) {
      final names = typing
          .map((uid) => nameByUid[uid] ?? uid)
          .toList(growable: false);
      if (names.length == 1) return '${names.first} is typing…';
      if (names.length == 2) {
        return '${names[0]} and ${names[1]} are typing…';
      }
      return '${names.length} people are typing…';
    }
    if (totalParticipants == 0) return 'Just you';
    if (totalParticipants == 1) return 'Just you';
    if (totalParticipants == 2) {
      final first = nameByUid.values.isNotEmpty
          ? nameByUid.values.first
          : '1 other';
      return 'You and $first';
    }
    final shown = nameByUid.values.take(3).join(', ');
    final more = totalParticipants - 4; // shown 3 + me
    return more > 0 ? '$shown, +$more others' : 'You, $shown';
  }
}

/// Frosted-glass square button for the navy chat header.

class _HeaderButton extends StatelessWidget {
  const _HeaderButton({
    required this.label,
    required this.icon,
    required this.onTap,
    this.iconSize = 18,
  });
  final String label;
  final IconData icon;
  final VoidCallback onTap;
  final double iconSize;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: label,
      child: PressableScale(
        onTap: onTap,
        child: Container(
          width: 38,
          height: 38,
          decoration: BoxDecoration(
            color: Colors.white.withValues(alpha: 0.14),
            borderRadius: BorderRadius.circular(AppRadius.sm),
            border: Border.all(color: Colors.white.withValues(alpha: 0.28)),
          ),
          alignment: Alignment.center,
          child: Icon(icon, size: iconSize, color: Colors.white),
        ),
      ),
    );
  }
}

/// Resolves the current user's Firebase auth uid from secure storage.
final _myUidProvider = FutureProvider<String?>((ref) async {
  ref.watch(authStateProvider.select((s) => s.userId));
  return SecureTokenStore.instance.readUserId();
});

/// Memoized "other participants" uid list for the typing indicator.
/// Same identity-stability contract as `_rosterUidsProvider` in the participants screen.
final _chatOtherUidsProvider = Provider.autoDispose
    .family<List<String>, ({String activityId, String? myUid})>((ref, args) {
      final roster =
          ref.watch(_participantsProvider(args.activityId)).valueOrNull ??
          const <ActivityParticipant>[];
      return roster
          .where((p) => p.userId != args.myUid)
          .map((p) => p.userId)
          .where((id) => id.isNotEmpty)
          .toList(growable: false);
    });

// Match banner.

/// Game-context card pinned above the message list.
