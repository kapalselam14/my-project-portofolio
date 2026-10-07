import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../core/providers/repository_providers.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/utils/geo.dart';
import '../../../core/utils/nav_guard.dart';
import '../../../core/utils/share_helper.dart';
import '../../../core/widgets/app_dialog.dart';
import '../../../core/theme/dark_colors.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/widgets/app_avatar.dart';
import '../../../core/widgets/app_button.dart';
import '../../../core/widgets/app_scaffold.dart';
import '../../../core/widgets/asset_image.dart';
import '../../../core/widgets/app_snackbar.dart';
import '../../../core/widgets/app_tappable.dart';
import '../../../core/widgets/error_retry.dart';
import '../../../core/widgets/label_badge.dart';
import '../../../core/widgets/pressable_scale.dart';
import 'widgets/detail_loading_skeleton.dart';
import 'widgets/activity_weather_section.dart';
import '../../calendar/domain/calendar_event.dart';
import '../../chat/domain/chat_message.dart';
import '../../discovery/domain/activity_model.dart';
import '../../discovery/presentation/widgets/venue_map_card.dart';
import '../domain/activity_participant.dart';
import 'my_activities_screen.dart';

part 'widgets/joined_hero.dart';
part 'widgets/joined_banners.dart';
part 'widgets/joined_info.dart';
part 'widgets/joined_roster.dart';
part 'widgets/joined_chat.dart';
part 'widgets/joined_actions.dart';

// Data type.

typedef _DetailData = ({
  ActivityModel activity,
  List<ChatMessage> recentMessages,
});

final _detailProvider = FutureProvider.autoDispose.family<_DetailData, String>((
  ref,
  activityId,
) async {
  final activity = await ref.watch(activityRepositoryProvider).byId(activityId);
  if (activity == null) throw StateError('Activity not found');
  final messages = await ref.watch(chatRepositoryProvider).messages(activityId);
  final recent = messages.length > 2
      ? messages.sublist(messages.length - 2)
      : messages;
  return (activity: activity, recentMessages: recent);
});

/// Live roster for the participant avatar stack — real faces only.
final _rosterProvider = FutureProvider.autoDispose
    .family<List<ActivityParticipant>, String>((ref, activityId) {
      return ref.watch(activityRepositoryProvider).participants(activityId);
    });

// Screen.

class JoinedActivityDetailScreen extends ConsumerWidget {
  const JoinedActivityDetailScreen({super.key, required this.activityId});
  final String activityId;

  Future<void> _confirmLeave(BuildContext context, WidgetRef ref) async {
    final confirmed = await AppDialog.confirm(
      context,
      title: 'Leave Activity?',
      body:
          'Are you sure you want to leave? You can re-join later if spots are available.',
      confirmLabel: 'Leave',
      destructive: true,
    );
    if (confirmed != true || !context.mounted) return;
    try {
      await ref.read(activityRepositoryProvider).leave(activityId);
      // Remember BEFORE invalidating: the refetch can no longer see it.
      final left = ref.read(_detailProvider(activityId)).valueOrNull?.activity;
      if (left != null) rememberLeftGame(ref, left);
      ref.invalidate(_detailProvider(activityId));
      ref.invalidate(activityFeedProvider);
      ref.invalidate(joinedGamesProvider);
      ref.invalidate(hostedGamesProvider);
      ref.invalidate(pastGamesProvider);
      if (!context.mounted) return;
      AppSnackbar.show(
        context,
        message: 'You have left the activity.',
        variant: AppSnackbarVariant.info,
      );
      if (context.mounted) context.go('/activities');
    } catch (_) {
      if (!context.mounted) return;
      AppSnackbar.show(
        context,
        message: 'Could not leave the activity. Please try again.',
        variant: AppSnackbarVariant.error,
      );
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(_detailProvider(activityId));

    return AppScaffold(
      safeAreaTop: false,
      backgroundColor: context.colors.background,
      showHomeIndicator: false,
      body: async.when(
        loading: () => const DetailLoadingSkeleton(bottomBar: false),
        error: (_, _) => ErrorRetry(
          message: 'Could not load this activity.',
          onRetry: () => ref.invalidate(_detailProvider(activityId)),
        ),
        // NOTE: _DetailBody must stay the direct child here (no
        // RefreshIndicator around it). Wrapping this Stack in a
        // RefreshIndicator collapses it to hero height (~280px) because a
        // Stack sizes non-positioned children with loose constraints —
        // that's what caused the half-screen bug. Pull-to-refresh lives
        // *inside* _DetailBody around the SingleChildScrollView instead.
        data: (data) => _DetailBody(
          activity: data.activity,
          recentMessages: data.recentMessages,
          onLeave: () => _confirmLeave(context, ref),
          onRefresh: () async {
            try {
              await ref
                  .read(activityRepositoryProvider)
                  .refreshActivityDetails(activityId);
            } catch (_) {
              if (context.mounted) {
                AppSnackbar.show(
                  context,
                  message: 'Could not refresh. Check your connection.',
                  variant: AppSnackbarVariant.error,
                );
              }
            }
            ref.invalidate(_detailProvider(activityId));
            ref.invalidate(_rosterProvider(activityId));
          },
        ),
      ),
    );
  }
}

// Detail body.

class _DetailBody extends StatelessWidget {
  const _DetailBody({
    required this.activity,
    required this.recentMessages,
    required this.onLeave,
    required this.onRefresh,
  });

  final ActivityModel activity;
  final List<ChatMessage> recentMessages;
  final VoidCallback onLeave;
  final Future<void> Function() onRefresh;

  // Must match activity_detail_screen hero height for visual consistency.
  static const double _heroHeight = 280;
  static const double _overlapAmount = 44;

  @override
  Widget build(BuildContext context) {
    // A cancelled game keeps rendering (history, chat, roster) but must say so loudly.
    final isCancelled = activity.lifecycleStatus.toLowerCase() == 'cancelled';
    return Stack(
      children: [
        // Hero.
        SizedBox(
          height: _heroHeight,
          width: double.infinity,
          child: _Hero(activity: activity),
        ),

        // Scrollable card.
        Positioned(
          top: _heroHeight - _overlapAmount,
          left: 0,
          right: 0,
          bottom: 0,
          child: Container(
            decoration: BoxDecoration(
              color: context.colors.surface,
              borderRadius: const BorderRadius.vertical(
                top: Radius.circular(AppRadius.xl),
              ),
              boxShadow: AppShadows.sheet,
            ),
            child: RefreshIndicator(
              // Pull-to-refresh bypasses the detail/roster caches so edits land immediately.
              onRefresh: onRefresh,
              child: SingleChildScrollView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.fromLTRB(
                  AppSpacing.x5,
                  AppSpacing.x5,
                  AppSpacing.x5,
                  AppSpacing.x8,
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Title + cancelled badge (host parity).
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Expanded(
                          child: Text(
                            activity.title,
                            style: AppTypography.headingDisplay(context),
                          ),
                        ),
                        if (isCancelled) ...[
                          const SizedBox(width: AppSpacing.x3),
                          LabelBadge(
                            label: 'CANCELLED',
                            background: context.colors.errorLight,
                            foreground: context.colors.errorText,
                          ),
                        ],
                      ],
                    ),
                    const SizedBox(height: AppSpacing.x4),

                    // Status banner: cancelled notice replaces "You're in".
                    if (isCancelled)
                      const _CancelledBanner()
                    else
                      _JoinedBanner(dateTime: activity.dateTime),
                    const SizedBox(height: AppSpacing.x4),

                    // Host card
                    _HostCard(
                      activityId: activity.id,
                      hostName: activity.hostName,
                      hostId: activity.hostId,
                      hostRating: activity.hostRating,
                    ),
                    const SizedBox(height: AppSpacing.x3),

                    // Meta card — date + location
                    _MetaCard(activity: activity),
                    ActivityWeatherSection(activity: activity),
                    const SizedBox(height: AppSpacing.x5),

                    // Venue map (only when coordinates exist).
                    if (activity.latitude != null &&
                        activity.longitude != null) ...[
                      VenueMapCard(activity: activity),
                      const SizedBox(height: AppSpacing.x5),
                    ],

                    // Participants
                    _ParticipantsSection(activity: activity),
                    const SizedBox(height: AppSpacing.x5),

                    // Group chat preview
                    _ChatSection(
                      messages: recentMessages,
                      activityId: activity.id,
                    ),
                    const SizedBox(height: AppSpacing.x5),

                    // Actions
                    _AddToCalendarButton(activity: activity),
                    const SizedBox(height: AppSpacing.x3),
                    _CheckInButton(activityId: activity.id),
                    const SizedBox(height: AppSpacing.x4),

                    // Leave
                    Center(
                      child: PressableScale(
                        onTap: onLeave,
                        child: Padding(
                          padding: const EdgeInsets.all(AppSpacing.x2),
                          child: Text(
                            'Leave Activity',
                            style: AppTypography.labelField(
                              context,
                            ).copyWith(color: context.colors.errorText),
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }
}

// Hero.
