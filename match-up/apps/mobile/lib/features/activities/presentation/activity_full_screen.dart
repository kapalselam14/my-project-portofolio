import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../core/providers/repository_providers.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/utils/geo.dart';
import '../../../core/theme/dark_colors.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/widgets/app_button.dart';
import '../../../core/widgets/app_icon.dart';
import '../../../core/widgets/app_scaffold.dart';
import '../../../core/widgets/app_snackbar.dart';
import '../../../core/widgets/asset_image.dart';
import '../../../core/widgets/error_retry.dart';
import '../../../core/widgets/pressable_scale.dart';
import 'widgets/detail_loading_skeleton.dart';
import '../../discovery/domain/activity_model.dart';
import 'my_activities_screen.dart';

typedef _FullData = ({ActivityModel activity, List<ActivityModel> similar});

final _fullProvider = FutureProvider.autoDispose.family<_FullData, String>((
  ref,
  activityId,
) async {
  final repo = ref.watch(activityRepositoryProvider);
  final activity = await repo.byId(activityId);
  if (activity == null) throw StateError('Activity not found');
  final matches = await repo.search(sport: activity.sportType);
  final similar =
      matches
          .where(
            (a) =>
                a.id != activityId &&
                !a.isFull &&
                !a.isParticipant &&
                !a.isHost,
          )
          .toList()
        ..sort((a, b) => a.distanceKm.compareTo(b.distanceKm));
  return (activity: activity, similar: similar.take(3).toList());
});

class ActivityFullScreen extends ConsumerWidget {
  const ActivityFullScreen({super.key, required this.activityId});

  final String activityId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(_fullProvider(activityId));

    return AppScaffold(
      backgroundColor: context.colors.surface,
      showHomeIndicator: false, // reached from inside ShellRoute screens.
      body: async.when(
        loading: () => const DetailLoadingSkeleton(bottomBar: false),
        error: (_, _) => ErrorRetry(
          message: 'Could not load this activity.',
          onRetry: () => ref.invalidate(_fullProvider(activityId)),
        ),
        data: (data) =>
            _FullBody(activity: data.activity, similar: data.similar),
      ),
    );
  }
}

class _FullBody extends StatelessWidget {
  const _FullBody({required this.activity, required this.similar});

  final ActivityModel activity;
  final List<ActivityModel> similar;

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(0, AppSpacing.x4, 0, AppSpacing.x6),
      child: Column(
        children: [
          const _TopHeader(),
          const SizedBox(height: AppSpacing.x6),
          _ActivityCard(activity: activity),
          const SizedBox(height: AppSpacing.x6),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: AppSpacing.x6),
            child: Column(
              children: [
                if (activity.requiresApproval) ...[
                  _WaitingListNotice(activity: activity),
                  const SizedBox(height: AppSpacing.x4),
                ],
                if (similar.isNotEmpty) ...[
                  _SimilarActivities(activities: similar),
                  const SizedBox(height: AppSpacing.x4),
                ],
                _Actions(activity: activity),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _TopHeader extends StatelessWidget {
  const _TopHeader();

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.x6),
      child: Column(
        children: [
          Container(
            padding: const EdgeInsets.symmetric(
              horizontal: AppSpacing.x4,
              vertical: AppSpacing.x1 + 2,
            ),
            decoration: BoxDecoration(
              color: context.colors.warningBg,
              borderRadius: AppRadius.pillR,
              border: Border.all(color: context.colors.warningLight),
            ),
            child: Text(
              'ACTIVITY FULL',
              style: AppTypography.chipLabel(
                context,
              ).copyWith(fontSize: 11, color: context.colors.warningText),
            ),
          ),
          const SizedBox(height: AppSpacing.x2),
          Text('Spots Filled', style: AppTypography.headlineLarge(context)),
          const SizedBox(height: AppSpacing.x2),
          Text(
            'This activity has reached maximum capacity',
            style: AppTypography.bodyFormSecondary(
              context,
            ).copyWith(color: context.colors.textSecondary),
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }
}

class _ActivityCard extends StatelessWidget {
  const _ActivityCard({required this.activity});
  final ActivityModel activity;

  @override
  Widget build(BuildContext context) {
    final timeFmt = DateFormat('EEE, h:mm a');

    return Stack(
      alignment: Alignment.topCenter,
      children: [
        Positioned(
          top: 60,
          child: Container(
            width: 240,
            height: 240,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              gradient: RadialGradient(
                colors: [
                  context.colors.primaryLight.withValues(alpha: 0.6),
                  context.colors.primaryLight.withValues(alpha: 0),
                ],
              ),
            ),
          ),
        ),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: AppSpacing.x6),
          child: Container(
            decoration: BoxDecoration(
              color: context.colors.surface,
              borderRadius: BorderRadius.circular(AppRadius.xl),
              border: Border.all(color: context.colors.border),
              boxShadow: AppShadows.floating,
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _CoverImage(activity: activity),
                Padding(
                  padding: const EdgeInsets.all(AppSpacing.x4 + 2),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        activity.title,
                        style: AppTypography.titleLarge(context),
                      ),
                      const SizedBox(height: AppSpacing.x1),
                      Row(
                        children: [
                          const AppIcon(AppIcons.mapPin, size: AppIconSize.sm),
                          const SizedBox(width: AppSpacing.x1 + 2),
                          Expanded(
                            child: Text(
                              activity.location,
                              style: AppTypography.chipLabel(
                                context,
                              ).copyWith(color: context.colors.textSecondary),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: AppSpacing.x3),
                      Row(
                        children: [
                          _MetaChip(
                            icon: AppIcons.zap,
                            label: activity.skillLevel,
                            color: context.colors.primaryOnSurface,
                          ),
                          const SizedBox(width: AppSpacing.x2),
                          _MetaChip(
                            icon: AppIcons.clock,
                            label: timeFmt.format(activity.dateTime),
                            color: context.colors.textSecondary,
                          ),
                        ],
                      ),
                      const SizedBox(height: AppSpacing.x3),
                      Container(height: 1, color: context.colors.border),
                      const SizedBox(height: AppSpacing.x3),
                      Row(
                        children: [
                          _AvatarStack(count: activity.participantCount),
                          const SizedBox(width: AppSpacing.x2),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  '${activity.capacity} / ${activity.capacity} spots',
                                  style: AppTypography.chipLabel(context),
                                ),
                                const SizedBox(height: 2),
                                ClipRRect(
                                  borderRadius: BorderRadius.circular(
                                    AppRadius.xs,
                                  ),
                                  child: SizedBox(
                                    height: 5,
                                    child: Stack(
                                      children: [
                                        Container(color: context.colors.border),
                                        Container(
                                          width: double.infinity,
                                          color: context.colors.errorText,
                                        ),
                                      ],
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: AppSpacing.x3,
                              vertical: AppSpacing.x1 + 2,
                            ),
                            decoration: BoxDecoration(
                              color: context.colors.errorLight,
                              borderRadius: BorderRadius.circular(AppRadius.lg),
                            ),
                            child: Text(
                              'Full',
                              style: AppTypography.chipLabel(context).copyWith(
                                fontSize: 11,
                                color: context.colors.errorText,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

class _CoverImage extends StatelessWidget {
  const _CoverImage({required this.activity});
  final ActivityModel activity;

  @override
  Widget build(BuildContext context) {
    final distanceText = distanceLabel(activity.distanceKm);
    return SizedBox(
      height: 140,
      width: double.infinity,
      child: Stack(
        fit: StackFit.expand,
        children: [
          ClipRRect(
            borderRadius: BorderRadius.vertical(
              top: Radius.circular(AppRadius.xl),
            ),
            child: AssetImageWithFallback(
              imagePath:
                  activity.coverImageUrl ??
                  'assets/images/discovery/covers/basketball_full.png',
              width: double.infinity,
              fit: BoxFit.cover,
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(AppSpacing.x3 + 2),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: AppSpacing.x3,
                    vertical: AppSpacing.x1 + 2,
                  ),
                  decoration: BoxDecoration(
                    color: AppColors.primary,
                    borderRadius: BorderRadius.circular(AppRadius.sm),
                  ),
                  child: Text(
                    activity.sportType.toUpperCase(),
                    style: AppTypography.chipLabel(
                      context,
                    ).copyWith(fontSize: 11, color: AppColors.textOnPrimary),
                  ),
                ),
                // Distance pill (hidden when unknown).
                if (distanceText != null)
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: AppSpacing.x2 + 2,
                      vertical: AppSpacing.x1 + 2,
                    ),
                    decoration: BoxDecoration(
                      color: context.colors.scrimControl,
                      borderRadius: BorderRadius.circular(AppRadius.lg),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        AppIcon(
                          AppIcons.mapPin,
                          size: AppIconSize.sm,
                          color: context.colors.textOnPrimary,
                        ),
                        const SizedBox(width: AppSpacing.x1),
                        Text(
                          distanceText,
                          style: AppTypography.chipLabel(context).copyWith(
                            fontSize: 11,
                            color: context.colors.textOnPrimary,
                          ),
                        ),
                      ],
                    ),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _MetaChip extends StatelessWidget {
  const _MetaChip({
    required this.icon,
    required this.label,
    required this.color,
  });
  final String icon;
  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.x2 + 2,
        vertical: AppSpacing.x1 + 2,
      ),
      decoration: BoxDecoration(
        color: context.colors.surfaceSubtle,
        borderRadius: BorderRadius.circular(AppRadius.lg),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          AppIcon(icon, size: AppIconSize.sm, color: color),
          const SizedBox(width: AppSpacing.x1 + 2),
          Text(
            label,
            style: AppTypography.chipLabel(
              context,
            ).copyWith(fontSize: 11, color: color),
          ),
        ],
      ),
    );
  }
}

/// Neutral participant placeholders — generic person icons sized by the live [count].
class _AvatarStack extends StatelessWidget {
  const _AvatarStack({required this.count});
  final int count;

  static const int _maxShown = 3;

  @override
  Widget build(BuildContext context) {
    final shown = count.clamp(0, _maxShown);
    if (shown == 0) return const SizedBox(width: 70, height: 30);
    return SizedBox(
      width: 70,
      height: 30,
      child: Stack(
        children: [
          for (var i = 0; i < shown; i++)
            Positioned(
              left: i * 20.0,
              child: Container(
                width: 30,
                height: 30,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: context.colors.surfaceMuted,
                  border: Border.all(color: context.colors.border, width: 2),
                ),
                alignment: Alignment.center,
                child: Icon(
                  Icons.person_outline,
                  size: 16,
                  color: context.colors.textSecondary,
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class _WaitingListNotice extends StatelessWidget {
  const _WaitingListNotice({required this.activity});
  final ActivityModel activity;

  @override
  Widget build(BuildContext context) {
    final waiting = activity.pendingRequestCount;
    return Container(
      padding: const EdgeInsets.all(AppSpacing.x3),
      decoration: BoxDecoration(
        color: context.colors.warningBg,
        borderRadius: BorderRadius.circular(AppRadius.card),
        border: Border.all(color: context.colors.warningLight),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              AppIcon(
                AppIcons.alertCircle,
                size: AppIconSize.md,
                color: context.colors.warningText,
              ),
              const SizedBox(width: AppSpacing.x2),
              Text(
                'Waiting list is open',
                style: AppTypography.labelField(
                  context,
                ).copyWith(color: context.colors.warningText),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.x1),
          Padding(
            padding: const EdgeInsets.only(left: AppSpacing.x6),
            child: Text(
              waiting > 0
                  ? '$waiting ${waiting == 1 ? 'person' : 'people'} waiting for approval.'
                  : 'Request to join — the host reviews each request.',
              style: AppTypography.bodySmall(context),
            ),
          ),
        ],
      ),
    );
  }
}

class _SimilarActivities extends StatelessWidget {
  const _SimilarActivities({required this.activities});
  final List<ActivityModel> activities;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Similar activities nearby',
          style: AppTypography.titleMedium(context),
        ),
        const SizedBox(height: AppSpacing.x3),
        for (final activity in activities) ...[
          _SimilarActivityRow(activity: activity),
          const SizedBox(height: AppSpacing.x2),
        ],
      ],
    );
  }
}

class _SimilarActivityRow extends StatelessWidget {
  const _SimilarActivityRow({required this.activity});
  final ActivityModel activity;

  @override
  Widget build(BuildContext context) {
    final timeFmt = DateFormat('EEE, h:mm a');
    return PressableScale(
      onTap: () => context.pushReplacement('/activity/${activity.id}'),
      child: Container(
        padding: const EdgeInsets.all(AppSpacing.x3),
        decoration: BoxDecoration(
          color: context.colors.surface,
          borderRadius: BorderRadius.circular(AppRadius.card),
          border: Border.all(color: context.colors.border),
        ),
        child: Row(
          children: [
            ClipRRect(
              borderRadius: BorderRadius.circular(AppRadius.input),
              child: AssetImageWithFallback(
                imagePath:
                    activity.coverImageUrl ??
                    'assets/images/discovery/covers/basketball_full.png',
                width: 48,
                height: 48,
                fit: BoxFit.cover,
              ),
            ),
            const SizedBox(width: AppSpacing.x3),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    activity.title,
                    style: AppTypography.labelField(context),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  Text(
                    '${timeFmt.format(activity.dateTime)} • ${activity.spotsLeft} spots left',
                    style: AppTypography.bodySmall(context),
                  ),
                ],
              ),
            ),
            const AppIcon(AppIcons.chevronRight, size: AppIconSize.sm),
          ],
        ),
      ),
    );
  }
}

class _Actions extends ConsumerStatefulWidget {
  const _Actions({required this.activity});
  final ActivityModel activity;

  @override
  ConsumerState<_Actions> createState() => _ActionsState();
}

class _ActionsState extends ConsumerState<_Actions> {
  bool _sending = false;

  Future<void> _requestJoin() async {
    if (_sending) return;
    setState(() => _sending = true);
    try {
      await ref
          .read(activityRepositoryProvider)
          .requestJoin(widget.activity.id);
      ref.invalidate(pendingGamesProvider);
      if (!mounted) return;
      AppSnackbar.show(
        context,
        message: 'Request sent! The host will review it soon.',
        variant: AppSnackbarVariant.success,
      );
      Navigator.of(context).maybePop();
    } catch (_) {
      if (!mounted) return;
      AppSnackbar.show(
        context,
        message: 'Could not send request. Please try again.',
        variant: AppSnackbarVariant.error,
      );
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final activity = widget.activity;
    // Approval-gated games can still take requests while full (the host may approve when a spot frees up).
    final canRequest =
        activity.requiresApproval &&
        !activity.hasPendingRequest &&
        !activity.hasStarted;
    final isFullButton = !activity.requiresApproval;
    return Column(
      children: [
        AppButton(
          label: activity.hasPendingRequest
              ? 'Request pending'
              : activity.requiresApproval
              ? 'Request to Join'
              : 'Activity Full',
          onPressed: canRequest ? _requestJoin : null,
          loading: _sending,
          size: AppButtonSize.lg,
        ),
        // Explainer under the disabled full-state button, pointing at the alternatives below.
        if (isFullButton && !canRequest) ...[
          const SizedBox(height: AppSpacing.x2),
          Text(
            'This game is full — check similar games below',
            style: AppTypography.bodySmall(
              context,
            ).copyWith(color: context.colors.textSecondary),
            textAlign: TextAlign.center,
          ),
        ],
        const SizedBox(height: AppSpacing.x3),
        PressableScale(
          onTap: () => Navigator.of(context).maybePop(),
          child: Padding(
            padding: const EdgeInsets.all(AppSpacing.x3),
            child: Text(
              'Keep Browsing',
              style: AppTypography.labelField(
                context,
              ).copyWith(color: context.colors.textSecondary, fontSize: 15),
            ),
          ),
        ),
      ],
    );
  }
}
