import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/providers/repository_providers.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/theme/dark_colors.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/utils/nav_guard.dart';
import '../../../core/widgets/app_avatar.dart';
import '../../../core/widgets/app_dialog.dart';
import '../../../core/widgets/app_scaffold.dart';
import '../../../core/widgets/app_snackbar.dart';
import '../../../core/widgets/empty_state.dart';
import '../../../core/widgets/error_retry.dart';
import '../../../core/widgets/pressable_scale.dart';
import '../../../core/widgets/skeleton.dart';
import '../../discovery/domain/activity_model.dart';
import '../domain/activity_participant.dart';

typedef _ParticipantsData = ({
  List<ActivityParticipant> roster,
  int capacity,
  String activityTitle,

  /// Host-only kick affordance: viewer is host AND the game is still live.
  bool canKick,
});

final _participantsProvider = FutureProvider.autoDispose
    .family<_ParticipantsData, String>((ref, activityId) async {
      final activityRepo = ref.watch(activityRepositoryProvider);
      // Fetch in parallel — the detail and the roster are independent.
      final results = await Future.wait([
        activityRepo.byId(activityId),
        activityRepo.participants(activityId),
      ]);
      final activity = results[0] as ActivityModel?;
      final roster = results[1] as List<ActivityParticipant>;
      // Kicking is meaningless on terminal lifecycles (cancelled/completed/removed) — same rule as Manage.
      final lc = activity?.lifecycleStatus.toLowerCase() ?? '';
      final terminal =
          lc == 'cancelled' || lc == 'completed' || lc == 'removed';
      return (
        roster: roster,
        capacity: activity?.capacity ?? roster.length,
        activityTitle: activity?.title ?? 'this activity',
        canKick: (activity?.isHost ?? false) && !terminal,
      );
    });

/// Polls the backend's `/api/presence/:uid` for each participant in the given list.
/// Polls every 30s (per [RemotePresenceRepository.watchOnline]).
/// IMPORTANT: the `uids` argument MUST be a stable list instance across rebuilds.
final _onlineUidsProvider = StreamProvider.autoDispose
    .family<Set<String>, List<String>>((ref, uids) {
      return ref.watch(presenceRepositoryProvider).watchOnline(uids);
    });

/// Memoized uid list for [_onlineUidsProvider].
final _rosterUidsProvider = Provider.autoDispose.family<List<String>, String>((
  ref,
  activityId,
) {
  final roster =
      ref.watch(_participantsProvider(activityId)).valueOrNull?.roster ??
      const [];
  return roster
      .map((p) => p.userId)
      .where((id) => id.isNotEmpty)
      .toList(growable: false);
});

class ActivityParticipantsScreen extends ConsumerStatefulWidget {
  final String activityId;

  const ActivityParticipantsScreen({super.key, required this.activityId});

  @override
  ConsumerState<ActivityParticipantsScreen> createState() =>
      _ActivityParticipantsScreenState();
}

class _ActivityParticipantsScreenState
    extends ConsumerState<ActivityParticipantsScreen> {
  String get activityId => widget.activityId;

  /// Uids with a kick currently in flight — their Remove buttons render disabled so rapid double-taps can't fire.
  final Set<String> _kicking = {};

  Future<void> _kick(String uid, String name) async {
    if (_kicking.contains(uid)) return;
    final confirmed = await AppDialog.confirm(
      context,
      title: 'Remove $name?',
      body:
          '$name will be removed from this activity and notified. They can re-join while spots are still available.',
      confirmLabel: 'Remove',
      cancelLabel: 'Keep',
      destructive: true,
    );
    if (confirmed != true) return;
    if (_kicking.contains(uid)) return;
    setState(() => _kicking.add(uid));
    try {
      await ref
          .read(activityRepositoryProvider)
          .removeParticipant(activityId: activityId, uid: uid);
      ref.invalidate(_participantsProvider(activityId));
      if (!mounted) return;
      AppSnackbar.show(
        context,
        message: '$name removed from the activity.',
        variant: AppSnackbarVariant.info,
      );
    } catch (_) {
      if (!mounted) return;
      AppSnackbar.show(
        context,
        message: 'Could not remove $name. Please try again.',
        variant: AppSnackbarVariant.error,
      );
    } finally {
      if (mounted) setState(() => _kicking.remove(uid));
    }
  }

  @override
  Widget build(BuildContext context) {
    final async = ref.watch(_participantsProvider(activityId));

    return AppScaffold.detail(
      title: 'Participants',
      showHomeIndicator: false, // reached from inside ShellRoute screens.
      backgroundColor: context.colors.surface,
      body: async.when(
        loading: () => const SkeletonList(count: 6),
        error: (_, _) => ErrorRetry(
          message: 'Could not load participants.',
          onRetry: () => ref.invalidate(_participantsProvider(activityId)),
        ),
        data: (result) {
          final roster = result.roster;
          final capacity = result.capacity;
          final fillRatio = capacity == 0
              ? 0.0
              : (roster.length / capacity).clamp(0.0, 1.0);

          // Watch online state for the roster.
          final uids = ref.watch(_rosterUidsProvider(activityId));
          final onlineUids =
              ref.watch(_onlineUidsProvider(uids)).valueOrNull ??
              const <String>{};

          return Column(
            children: [
              _CapacitySummary(
                activityTitle: result.activityTitle,
                joined: roster.length,
                capacity: capacity,
                fillRatio: fillRatio,
                onlineCount: onlineUids.length,
              ),
              Expanded(
                child: roster.isEmpty
                    ? const EmptyState(
                        icon: Icons.people_outline_rounded,
                        title: 'No participants yet',
                        subtitle:
                            'Approved players will appear here once they join.',
                      )
                    : RefreshIndicator(
                        onRefresh: () async {
                          ref.invalidate(_participantsProvider(activityId));
                          await ref
                              .read(_participantsProvider(activityId).future)
                              .then((_) {})
                              .catchError((_) {});
                        },
                        color: AppColors.primary,
                        child: ListView.separated(
                          physics: const AlwaysScrollableScrollPhysics(),
                          padding: const EdgeInsets.fromLTRB(
                            AppSpacing.x4,
                            AppSpacing.x4,
                            AppSpacing.x4,
                            AppSpacing.x4,
                          ),
                          itemCount: roster.length,
                          separatorBuilder: (_, _) =>
                              const SizedBox(height: AppSpacing.x3),
                          itemBuilder: (_, i) {
                            final p = roster[i];
                            return _ParticipantCard(
                              item: p,
                              isOnline: onlineUids.contains(p.userId),
                              canKick: result.canKick,
                              kicking: _kicking.contains(p.userId),
                              onKick: () => _kick(p.userId, p.name),
                            );
                          },
                        ),
                      ),
              ),
            ],
          );
        },
      ),
    );
  }
}

class _CapacitySummary extends StatelessWidget {
  const _CapacitySummary({
    required this.activityTitle,
    required this.joined,
    required this.capacity,
    required this.fillRatio,
    required this.onlineCount,
  });

  final String activityTitle;
  final int joined;
  final int capacity;
  final double fillRatio;
  final int onlineCount;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.x5,
        0,
        AppSpacing.x5,
        AppSpacing.x4,
      ),
      decoration: BoxDecoration(
        border: Border(bottom: BorderSide(color: context.colors.border)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            activityTitle,
            style: AppTypography.labelField(
              context,
            ).copyWith(color: context.colors.primaryOnSurface),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
          const SizedBox(height: AppSpacing.x1),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                '$joined/$capacity spots filled',
                style: AppTypography.bodySmall(
                  context,
                ).copyWith(color: context.colors.textSecondary),
              ),
              Text(
                '${(fillRatio * 100).round()}% full',
                style: AppTypography.chipLabel(
                  context,
                ).copyWith(color: context.colors.primaryOnSurface),
              ),
            ],
          ),
          // Online-now chip.
          if (onlineCount > 0) ...[
            const SizedBox(height: AppSpacing.x2),
            Row(
              children: [
                Container(
                  width: 8,
                  height: 8,
                  decoration: const BoxDecoration(
                    color: AppColors.success,
                    shape: BoxShape.circle,
                  ),
                ),
                const SizedBox(width: AppSpacing.x2),
                Text(
                  onlineCount == 1
                      ? '1 person online now'
                      : '$onlineCount people online now',
                  style: AppTypography.bodySmall(
                    context,
                  ).copyWith(color: context.colors.textSecondary),
                ),
              ],
            ),
          ],
          const SizedBox(height: AppSpacing.x2),
          ClipRRect(
            borderRadius: BorderRadius.circular(AppRadius.xs),
            child: SizedBox(
              height: 8,
              child: Stack(
                children: [
                  Container(color: context.colors.border),
                  FractionallySizedBox(
                    widthFactor: fillRatio,
                    child: Container(color: AppColors.primary),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _ParticipantCard extends StatelessWidget {
  const _ParticipantCard({
    required this.item,
    required this.isOnline,
    required this.canKick,
    required this.kicking,
    required this.onKick,
  });
  final ActivityParticipant item;
  final bool isOnline;

  /// Host-only kick affordance (false for non-host viewers and on terminal games).
  final bool canKick;

  /// True while this row's kick is in flight.
  final bool kicking;
  final VoidCallback onKick;

  @override
  Widget build(BuildContext context) {
    // The host can't kick themselves; the inner button wins the tap arena so Remove never also opens the profile.
    final showRemove = canKick && !item.isOrganizer;
    return PressableScale(
      // pushOnce guard (duplicate page keys red-screen).
      onTap: () => NavGuard.push(
        context,
        item.userId.isNotEmpty
            ? '/player-profile/uid/${item.userId}'
            : '/player-profile/${item.name}',
      ),
      child: Container(
        padding: const EdgeInsets.all(AppSpacing.x3),
        decoration: BoxDecoration(
          color: item.isOrganizer
              ? context.colors.primarySoft
              : context.colors.surface,
          borderRadius: BorderRadius.circular(AppRadius.card),
          border: Border.all(
            color: item.isOrganizer
                ? context.colors.primaryLight
                : context.colors.border,
          ),
        ),
        child: Row(
          children: [
            // Avatar + online dot overlay
            SizedBox(
              width: 44,
              height: 44,
              child: Stack(
                clipBehavior: Clip.none,
                children: [
                  ClipRRect(
                    borderRadius: BorderRadius.circular(AppRadius.lg),
                    // Prefer the backend photo URL when the user has one; otherwise AppAvatar renders their initials.
                    child: AppAvatar(
                      imageUrl: item.avatarUrl,
                      name: item.name,
                      size: AppAvatarSize.md,
                    ),
                  ),
                  if (isOnline)
                    Positioned(
                      right: -2,
                      bottom: -2,
                      child: Container(
                        width: 14,
                        height: 14,
                        decoration: BoxDecoration(
                          color: AppColors.success,
                          shape: BoxShape.circle,
                          border: Border.all(
                            color: context.colors.surface,
                            width: 2,
                          ),
                        ),
                      ),
                    ),
                ],
              ),
            ),
            const SizedBox(width: AppSpacing.x3),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Flexible(
                        child: Text(
                          item.name,
                          style: AppTypography.labelField(
                            context,
                          ).copyWith(fontSize: 15),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      if (item.isOrganizer) ...[
                        const SizedBox(width: AppSpacing.x1 + 2),
                        _OrganizerBadge(),
                      ],
                    ],
                  ),
                  const SizedBox(height: AppSpacing.x1),
                  _SkillChip(label: item.skillLevel),
                ],
              ),
            ),
            Text(
              _timeAgo(item.joinedAt),
              style: AppTypography.caption(context),
            ),
            if (showRemove) ...[
              const SizedBox(height: 4),
              Semantics(
                button: true,
                enabled: !kicking,
                label: 'Remove participant',
                child: PressableScale(
                  onTap: kicking ? null : onKick,
                  child: Opacity(
                    opacity: kicking ? 0.45 : 1,
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
                          style: AppTypography.caption(context).copyWith(
                            color: context.colors.errorText,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  String _timeAgo(DateTime joinedAt) {
    final diff = DateTime.now().difference(joinedAt);
    // Clamp clock-skewed future timestamps to "Just now".
    if (diff.isNegative || diff.inMinutes < 1) return 'Just now';
    if (diff.inHours < 1) return 'Joined ${diff.inMinutes}m ago';
    if (diff.inHours < 24) return 'Joined ${diff.inHours}h ago';
    if (diff.inDays == 1) return 'Joined 1 day ago';
    return 'Joined ${diff.inDays} days ago';
  }
}

/// "Organizer" role badge.
class _OrganizerBadge extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.x1 + 2,
        vertical: 2,
      ),
      decoration: BoxDecoration(
        color: context.colors.warningBg,
        borderRadius: BorderRadius.circular(AppRadius.pill),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            Icons.workspace_premium,
            size: 12,
            color: context.colors.warningText,
          ),
          const SizedBox(width: 4),
          Text(
            'Organizer',
            style: AppTypography.chipLabel(context).copyWith(
              fontSize: 11,
              color: context.colors.warningText,
              height: 1.0,
            ),
          ),
        ],
      ),
    );
  }
}

class _SkillChip extends StatelessWidget {
  const _SkillChip({required this.label});
  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.x2,
        vertical: 3,
      ),
      decoration: BoxDecoration(
        color: context.colors.surfaceSubtle,
        borderRadius: BorderRadius.circular(AppRadius.pill),
      ),
      child: Text(
        label,
        style: AppTypography.chipLabel(
          context,
        ).copyWith(fontSize: 11, color: context.colors.textSecondary),
      ),
    );
  }
}
