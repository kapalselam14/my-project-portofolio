import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../core/providers/repository_providers.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/theme/dark_colors.dart';
import '../../../core/widgets/app_scaffold.dart';
import '../../../core/widgets/system_back.dart';
import '../../../core/widgets/app_snackbar.dart';
import '../../../core/widgets/asset_image.dart';
import '../../../core/widgets/error_retry.dart';
import '../../../core/widgets/pressable_scale.dart';
import '../../../core/widgets/skeleton.dart';
import '../../discovery/domain/activity_model.dart';
import 'my_activities_screen.dart';

/// Shown after requesting to join an approval-gated activity.
/// Unlike the instant-join "Match" screen, nothing is confirmed yet.
class JoinRequestSentScreen extends ConsumerWidget {
  const JoinRequestSentScreen({super.key, required this.activityId});
  final String activityId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(_requestActivityProvider(activityId));
    // System back on a go-opened confirmation (deck swipe flow) would otherwise close the app — fall back to Discover.
    return SystemBackFallback(
      onEmptyStack: (context) => context.go('/discovery'),
      child: AppScaffold(
        showHomeIndicator: false,
        backgroundColor: context.colors.background,
        body: async.when(
          loading: () => const SkeletonList(count: 3),
          error: (_, _) => ErrorRetry(
            message: 'Could not load this activity.',
            onRetry: () => ref.invalidate(_requestActivityProvider(activityId)),
          ),
          data: (activity) {
            if (activity == null) {
              return Center(
                child: Padding(
                  padding: const EdgeInsets.all(AppSpacing.x5),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Text('Activity not found.'),
                      const SizedBox(height: AppSpacing.x4),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          PressableScale(
                            onTap: () {
                              HapticFeedback.lightImpact();
                              if (context.canPop()) {
                                context.pop();
                              } else {
                                context.go('/discovery');
                              }
                            },
                            child: Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: AppSpacing.x5,
                                vertical: AppSpacing.x3,
                              ),
                              decoration: BoxDecoration(
                                borderRadius: BorderRadius.circular(
                                  AppRadius.pill,
                                ),
                                border: Border.all(
                                  color: context.colors.border,
                                ),
                              ),
                              alignment: Alignment.center,
                              child: Text(
                                'Back',
                                style: AppTypography.buttonPrimary.copyWith(
                                  color: context.colors.textPrimary,
                                ),
                              ),
                            ),
                          ),
                          const SizedBox(width: AppSpacing.x3),
                          PressableScale(
                            onTap: () => ref.invalidate(
                              _requestActivityProvider(activityId),
                            ),
                            child: Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: AppSpacing.x5,
                                vertical: AppSpacing.x3,
                              ),
                              decoration: BoxDecoration(
                                color: AppColors.primary,
                                borderRadius: BorderRadius.circular(
                                  AppRadius.pill,
                                ),
                                boxShadow: AppShadows.glowPrimary,
                              ),
                              alignment: Alignment.center,
                              child: Text(
                                'Retry',
                                style: AppTypography.buttonPrimary,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              );
            }
            return _RequestBody(activity: activity);
          },
        ),
      ),
    );
  }
}

final _requestActivityProvider = FutureProvider.autoDispose
    .family<ActivityModel?, String>((ref, id) {
      return ref.watch(activityRepositoryProvider).byId(id);
    });

class _RequestBody extends ConsumerStatefulWidget {
  const _RequestBody({required this.activity});
  final ActivityModel activity;

  @override
  ConsumerState<_RequestBody> createState() => _RequestBodyState();
}

class _RequestBodyState extends ConsumerState<_RequestBody> {
  bool _withdrawing = false;

  /// Withdraws the pending join request.
  Future<void> _withdraw() async {
    if (_withdrawing) return;
    setState(() => _withdrawing = true);
    try {
      await ref.read(activityRepositoryProvider).leave(widget.activity.id);
      ref.invalidate(pendingGamesProvider);
      if (!mounted) return;
      HapticFeedback.mediumImpact();
      AppSnackbar.show(
        context,
        message: 'Request withdrawn.',
        variant: AppSnackbarVariant.success,
      );
      if (context.canPop()) {
        context.pop();
      } else {
        context.go('/discovery');
      }
    } catch (_) {
      if (!mounted) return;
      AppSnackbar.show(
        context,
        message: 'Could not withdraw the request. Please try again.',
        variant: AppSnackbarVariant.error,
      );
    } finally {
      if (mounted) setState(() => _withdrawing = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final activity = widget.activity;
    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.x5,
        AppSpacing.x8,
        AppSpacing.x5,
        AppSpacing.x8,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          // Pending hero
          Container(
            width: 96,
            height: 96,
            decoration: BoxDecoration(
              color: context.colors.warningBg,
              shape: BoxShape.circle,
              border: Border.all(
                color: context.colors.warningText.withValues(alpha: 0.3),
              ),
            ),
            alignment: Alignment.center,
            child: Icon(
              Icons.hourglass_top_rounded,
              size: 44,
              color: context.colors.warningText,
            ),
          ),
          const SizedBox(height: AppSpacing.x5),
          Text(
            'Request sent!',
            style: AppTypography.headingDisplay(context),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: AppSpacing.x2),
          Text(
            'The host will review your request soon. '
            'We\u2019ll notify you the moment they decide.',
            style: AppTypography.bodyMedium(
              context,
            ).copyWith(color: context.colors.textSecondary),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: AppSpacing.x5),

          // Activity summary
          _SummaryCard(activity: activity),
          const SizedBox(height: AppSpacing.x5),

          // What happens next
          const _NextSteps(),
          const SizedBox(height: AppSpacing.x6),

          // Back to Discover — primary
          PressableScale(
            onTap: () {
              HapticFeedback.lightImpact();
              context.go('/discovery');
            },
            child: Container(
              width: double.infinity,
              height: 58,
              decoration: BoxDecoration(
                color: AppColors.primary,
                borderRadius: BorderRadius.circular(AppRadius.pill),
                boxShadow: AppShadows.glowPrimary,
              ),
              alignment: Alignment.center,
              child: Text(
                'Back to Discover',
                style: AppTypography.buttonPrimary,
              ),
            ),
          ),
          const SizedBox(height: AppSpacing.x3),

          // View details — secondary (the pending-request detail.
          PressableScale(
            onTap: () {
              HapticFeedback.lightImpact();
              context.go('/pending-request/${activity.id}');
            },
            child: Container(
              width: double.infinity,
              height: 58,
              decoration: BoxDecoration(
                color: Colors.transparent,
                borderRadius: BorderRadius.circular(AppRadius.pill),
                border: Border.all(color: context.colors.border),
              ),
              alignment: Alignment.center,
              child: Text(
                'View Activity Details',
                style: AppTypography.buttonPrimary.copyWith(
                  color: context.colors.textPrimary,
                ),
              ),
            ),
          ),
          const SizedBox(height: AppSpacing.x2),

          // Withdraw request — tertiary text action.
          Semantics(
            button: true,
            label: 'Withdraw request',
            child: PressableScale(
              onTap: _withdrawing ? null : _withdraw,
              child: Padding(
                padding: const EdgeInsets.symmetric(
                  horizontal: AppSpacing.x4,
                  vertical: AppSpacing.x2,
                ),
                child: _withdrawing
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : Text(
                        'Withdraw request',
                        style: AppTypography.labelField(context).copyWith(
                          color: context.colors.errorText,
                          decoration: TextDecoration.underline,
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

class _SummaryCard extends StatelessWidget {
  const _SummaryCard({required this.activity});
  final ActivityModel activity;

  @override
  Widget build(BuildContext context) {
    final date = DateFormat('EEEE, MMMM d').format(activity.dateTime);
    final time = DateFormat('h:mm a').format(activity.dateTime);
    return Container(
      padding: const EdgeInsets.all(AppSpacing.x4),
      decoration: BoxDecoration(
        color: context.colors.surface,
        borderRadius: BorderRadius.circular(AppRadius.card),
        border: Border.all(color: context.colors.border),
        boxShadow: AppShadows.card,
      ),
      child: Row(
        children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(AppRadius.input),
            child: SizedBox(
              width: 64,
              height: 64,
              child: activity.coverImageUrl != null
                  ? AssetImageWithFallback(
                      imagePath: activity.coverImageUrl!,
                      fit: BoxFit.cover,
                    )
                  : Container(
                      color: context.colors.primarySoft,
                      alignment: Alignment.center,
                      child: Icon(
                        Icons.sports_basketball_rounded,
                        size: 28,
                        color: context.colors.primaryOnSurface,
                      ),
                    ),
            ),
          ),
          const SizedBox(width: AppSpacing.x3),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  activity.title,
                  style: AppTypography.labelField(
                    context,
                  ).copyWith(fontWeight: FontWeight.w700, fontSize: 15),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 2),
                Text(
                  '$date · $time',
                  style: AppTypography.metaSub(context),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 2),
                Text(
                  activity.location,
                  style: AppTypography.metaSub(context),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _NextSteps extends StatelessWidget {
  const _NextSteps();

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(AppSpacing.x4),
      decoration: BoxDecoration(
        color: context.colors.surface,
        borderRadius: BorderRadius.circular(AppRadius.card),
        border: Border.all(color: context.colors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'What happens next',
            style: AppTypography.labelField(
              context,
            ).copyWith(fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: AppSpacing.x3),
          _Step(
            icon: Icons.send_rounded,
            text: 'Your request is with the host.',
          ),
          const SizedBox(height: AppSpacing.x2),
          _Step(
            icon: Icons.notifications_none_rounded,
            text: 'You get notified on approve or decline.',
          ),
          const SizedBox(height: AppSpacing.x2),
          _Step(
            icon: Icons.check_circle_outline_rounded,
            text: 'Approved? The game appears in My Games.',
          ),
        ],
      ),
    );
  }
}

class _Step extends StatelessWidget {
  const _Step({required this.icon, required this.text});
  final IconData icon;
  final String text;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icon, size: 18, color: context.colors.primaryOnSurface),
        const SizedBox(width: AppSpacing.x3),
        Expanded(
          child: Text(
            text,
            style: AppTypography.bodyMedium(context).copyWith(fontSize: 14),
          ),
        ),
      ],
    );
  }
}
