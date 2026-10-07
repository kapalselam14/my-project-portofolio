import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../core/providers/repository_providers.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/theme/dark_colors.dart';
import '../../../core/utils/geo.dart';
import '../../../core/utils/nav_guard.dart';
import '../../../core/widgets/app_avatar.dart';
import '../../../core/widgets/app_button.dart';
import '../../../core/widgets/app_dialog.dart';
import '../../../core/widgets/app_scaffold.dart';
import '../../../core/widgets/app_snackbar.dart';
import '../../../core/widgets/asset_image.dart';
import '../../../core/widgets/error_retry.dart';
import 'widgets/detail_loading_skeleton.dart';
import '../../discovery/domain/activity_model.dart';
import '../../discovery/presentation/widgets/venue_map_card.dart';
import 'my_activities_screen.dart';

/// Read-only detail for an activity the viewer requested to join but the host hasn't approved yet.
/// Deliberately sparse: no chat entry, no check-in, no join actions — the viewer isn't a participant.
class PendingRequestDetailScreen extends ConsumerWidget {
  const PendingRequestDetailScreen({super.key, required this.activityId});
  final String activityId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(_pendingDetailProvider(activityId));
    return AppScaffold(
      showHomeIndicator: false,
      // Full-bleed hero like the standard detail screen: the cover extends behind the status bar instead of starting.
      safeAreaTop: false,
      backgroundColor: context.colors.background,
      body: async.when(
        loading: () => const DetailLoadingSkeleton(bottomBar: false),
        error: (_, _) => ErrorRetry(
          message: 'Could not load this activity.',
          onRetry: () => ref.invalidate(_pendingDetailProvider(activityId)),
        ),
        data: (activity) {
          if (activity == null) {
            return const Center(child: Text('Activity not found.'));
          }
          return _PendingBody(activity: activity);
        },
      ),
    );
  }
}

final _pendingDetailProvider = FutureProvider.autoDispose
    .family<ActivityModel?, String>((ref, id) {
      return ref.watch(activityRepositoryProvider).byId(id);
    });

class _PendingBody extends ConsumerWidget {
  const _PendingBody({required this.activity});
  final ActivityModel activity;

  Future<void> _cancelRequest(BuildContext context, WidgetRef ref) async {
    final confirmed = await AppDialog.confirm(
      context,
      title: 'Cancel Request?',
      body:
          'Your join request for "${activity.title}" will be withdrawn. You can request again later.',
      confirmLabel: 'Cancel Request',
      cancelLabel: 'Keep it',
      destructive: true,
    );
    if (confirmed != true || !context.mounted) return;
    try {
      await ref.read(activityRepositoryProvider).leave(activity.id);
      ref.invalidate(pendingGamesProvider);
      if (!context.mounted) return;
      AppSnackbar.show(
        context,
        message: 'Request withdrawn.',
        variant: AppSnackbarVariant.success,
      );
      Navigator.of(context).maybePop();
    } catch (_) {
      if (!context.mounted) return;
      AppSnackbar.show(
        context,
        message: 'Could not withdraw. Please try again.',
        variant: AppSnackbarVariant.error,
      );
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return RefreshIndicator(
      onRefresh: () async {
        ref.invalidate(_pendingDetailProvider(activity.id));
        await ref
            .read(_pendingDetailProvider(activity.id).future)
            .then((_) {})
            .catchError((_) {});
      },
      color: AppColors.primary,
      child: SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Cover hero — same 280px anatomy as the standard detail screen, with an overlapping sheet below.
            SizedBox(
              height: 280,
              width: double.infinity,
              child: Stack(
                fit: StackFit.expand,
                children: [
                  activity.coverImageUrl != null
                      ? AssetImageWithFallback(
                          imagePath: activity.coverImageUrl!,
                          fit: BoxFit.cover,
                        )
                      : Container(
                          decoration: const BoxDecoration(
                            gradient: LinearGradient(
                              begin: Alignment.topLeft,
                              end: Alignment.bottomRight,
                              colors: [
                                AppColors.primary,
                                AppColors.primaryDark,
                              ],
                            ),
                          ),
                          child: Center(
                            child: Icon(
                              Icons.sports,
                              size: 64,
                              color: AppColors.textOnPrimary.withValues(
                                alpha: 0.38,
                              ),
                            ),
                          ),
                        ),
                  Positioned(
                    top: 0,
                    left: 0,
                    child: SafeArea(
                      bottom: false,
                      child: Padding(
                        padding: const EdgeInsets.all(AppSpacing.x4),
                        child: Semantics(
                          button: true,
                          label: 'Back',
                          child: GestureDetector(
                            onTap: () {
                              if (Navigator.of(context).canPop()) {
                                Navigator.of(context).pop();
                              } else {
                                context.go('/activities');
                              }
                            },
                            child: Container(
                              width: 44,
                              height: 44,
                              decoration: const BoxDecoration(
                                color: AppColors.scrimControl,
                                shape: BoxShape.circle,
                              ),
                              alignment: Alignment.center,
                              child: const Icon(
                                Icons.arrow_back_rounded,
                                size: 20,
                                color: AppColors.textOnPrimary,
                              ),
                            ),
                          ),
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),

            // Overlapping sheet.
            Container(
              transform: Matrix4.translationValues(0, -20, 0),
              decoration: BoxDecoration(
                color: context.colors.surface,
                borderRadius: const BorderRadius.vertical(
                  top: Radius.circular(AppRadius.xl),
                ),
              ),
              padding: const EdgeInsets.fromLTRB(
                AppSpacing.x5,
                AppSpacing.x4,
                AppSpacing.x5,
                AppSpacing.x8,
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  // Status banner
                  Container(
                    padding: const EdgeInsets.all(AppSpacing.x4),
                    decoration: BoxDecoration(
                      color: context.colors.warningBg,
                      borderRadius: BorderRadius.circular(AppRadius.card),
                      border: Border.all(
                        color: context.colors.warningText.withValues(
                          alpha: 0.3,
                        ),
                      ),
                    ),
                    child: Row(
                      children: [
                        Icon(
                          Icons.hourglass_top_rounded,
                          size: 22,
                          color: context.colors.warningText,
                        ),
                        const SizedBox(width: AppSpacing.x3),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                'Waiting for host approval',
                                style: AppTypography.labelField(context)
                                    .copyWith(
                                      color: context.colors.warningText,
                                      fontWeight: FontWeight.w700,
                                    ),
                              ),
                              const SizedBox(height: 2),
                              Text(
                                'You can look around, but chat and check-in unlock after approval.',
                                style: AppTypography.metaSub(context).copyWith(
                                  color: context.colors.warningText,
                                  fontSize: 13,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: AppSpacing.x4),

                  Text(
                    activity.title,
                    style: AppTypography.headingDisplay(context),
                  ),
                  const SizedBox(height: AppSpacing.x3),

                  // Host row — tappable, same as the standard detail.
                  _HostRow(activity: activity),
                  const SizedBox(height: AppSpacing.x3),

                  // Meta card — date / location / fee rows.
                  _MetaCard(activity: activity),
                  const SizedBox(height: AppSpacing.x5),

                  if (activity.latitude != null &&
                      activity.longitude != null) ...[
                    VenueMapCard(activity: activity),
                    const SizedBox(height: AppSpacing.x5),
                  ],

                  if (activity.description.isNotEmpty) ...[
                    Text(
                      'About this Activity',
                      style: AppTypography.titleMedium(context),
                    ),
                    const SizedBox(height: AppSpacing.x2),
                    Text(
                      activity.description,
                      style: AppTypography.bodyReading(context),
                    ),
                    const SizedBox(height: AppSpacing.x6),
                  ],

                  // The only action: withdraw.
                  AppButton.danger(
                    label: 'Cancel Request',
                    onPressed: () => _cancelRequest(context, ref),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// Host row (tappable, mirrors the standard detail screen).

class _HostRow extends StatelessWidget {
  const _HostRow({required this.activity});
  final ActivityModel activity;

  @override
  Widget build(BuildContext context) {
    final hostId = activity.hostId.trim();
    final canOpen = hostId.isNotEmpty;
    return Semantics(
      button: canOpen,
      label: canOpen ? 'View host profile: ${activity.hostName}' : null,
      child: GestureDetector(
        // Same pushOnce guard as the standard detail host card.
        onTap: canOpen
            ? () => NavGuard.push(context, '/player-profile/uid/$hostId')
            : null,
        behavior: HitTestBehavior.opaque,
        child: Container(
          padding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.x4,
            vertical: AppSpacing.x3,
          ),
          decoration: BoxDecoration(
            color: context.colors.surface,
            borderRadius: BorderRadius.circular(AppRadius.card),
            border: Border.all(color: context.colors.border),
          ),
          child: Row(
            children: [
              AppAvatar(name: activity.hostName, size: AppAvatarSize.sm),
              const SizedBox(width: AppSpacing.x3),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      activity.hostName,
                      style: AppTypography.labelField(
                        context,
                      ).copyWith(fontSize: 15, fontWeight: FontWeight.w700),
                    ),
                    Text('Host', style: AppTypography.metaSub(context)),
                  ],
                ),
              ),
              if (activity.hostRating != null)
                Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(
                      Icons.star_rounded,
                      size: 16,
                      color: context.colors.successText,
                    ),
                    const SizedBox(width: 4),
                    Text(
                      activity.hostRating!.toStringAsFixed(1),
                      style: AppTypography.labelField(context).copyWith(
                        color: context.colors.successText,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ],
                )
              else
                Text(
                  'New host',
                  style: AppTypography.metaSub(
                    context,
                  ).copyWith(fontWeight: FontWeight.w600),
                ),
              if (canOpen) ...[
                const SizedBox(width: AppSpacing.x1),
                Icon(
                  Icons.chevron_right_rounded,
                  size: 20,
                  color: context.colors.textTertiary,
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

// ─── Meta card (date / location / fee, mirrors the standard detail) ─────────

class _MetaCard extends StatelessWidget {
  const _MetaCard({required this.activity});
  final ActivityModel activity;

  @override
  Widget build(BuildContext context) {
    final date = DateFormat('EEEE, MMMM d').format(activity.dateTime);
    final timeRange =
        '${DateFormat('h:mm a').format(activity.dateTime)} - ${DateFormat('h:mm a').format(activity.endTime)}';
    // Same fallback as joined/manage: never leave the second line blank.
    final address =
        activity.addressLine ?? distanceLabel(activity.distanceKm) ?? '';
    return Container(
      decoration: BoxDecoration(
        color: context.colors.surface,
        borderRadius: BorderRadius.circular(AppRadius.card),
        border: Border.all(color: context.colors.border),
      ),
      child: Column(
        children: [
          _MetaRow(
            icon: Icons.calendar_today_outlined,
            title: date,
            sub: timeRange,
          ),
          Divider(height: 1, color: context.colors.border, indent: 60),
          _MetaRow(
            icon: Icons.place_outlined,
            title: activity.location,
            sub: address,
          ),
          Divider(height: 1, color: context.colors.border, indent: 60),
          _MetaRow(
            icon: Icons.payments_outlined,
            title: !activity.isPaid
                ? 'Free Activity'
                : activity.isSplitCost
                ? 'Split Cost'
                : 'Paid Activity',
            sub: !activity.isPaid
                ? 'No cost to join'
                : activity.splitExplainer ??
                      activity.feeLabel ??
                      'Fee required to join',
          ),
        ],
      ),
    );
  }
}

class _MetaRow extends StatelessWidget {
  const _MetaRow({required this.icon, required this.title, required this.sub});
  final IconData icon;
  final String title;
  final String sub;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.x4,
        vertical: AppSpacing.x3,
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: context.colors.primarySoft,
              shape: BoxShape.circle,
            ),
            alignment: Alignment.center,
            child: Icon(icon, size: 18, color: context.colors.primaryOnSurface),
          ),
          const SizedBox(width: AppSpacing.x3),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: AppTypography.labelField(
                    context,
                  ).copyWith(fontSize: 14),
                ),
                if (sub.isNotEmpty)
                  Text(
                    sub,
                    style: AppTypography.metaSub(context),
                    maxLines: 2,
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
