import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:dio/dio.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../core/network/api_client.dart';
import '../../../core/providers/repository_providers.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/utils/geo.dart';
import '../../../core/utils/nav_guard.dart';
import '../../../core/utils/share_helper.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/theme/dark_colors.dart';
import '../../../core/widgets/app_avatar.dart';
import '../../../core/widgets/app_icon.dart';
import '../../../core/widgets/asset_image.dart';
import '../../../core/widgets/app_scaffold.dart';
import '../../../core/widgets/system_back.dart';
import '../../../core/widgets/app_snackbar.dart';
import '../../../core/widgets/error_retry.dart';
import '../../../core/widgets/pressable_scale.dart';
import '../../../core/widgets/skeleton.dart';
import '../../activities/domain/activity_model.dart';
import '../../activities/presentation/widgets/activity_weather_section.dart';
import '../../activities/presentation/widgets/detail_loading_skeleton.dart';
import '../../activities/domain/activity_participant.dart';
import '../../activities/presentation/my_activities_screen.dart';
import '../../report/presentation/report_activity_sheet.dart';
import 'widgets/venue_map_card.dart';

part 'widgets/detail_hero.dart';
part 'widgets/detail_info.dart';
part 'widgets/detail_roster.dart';
part 'widgets/detail_actions.dart';

/// Back navigation that always lands somewhere.
void _popOrDiscovery(BuildContext context) {
  if (Navigator.of(context).canPop()) {
    Navigator.of(context).pop();
  } else {
    context.go('/discovery');
  }
}

// Provider.
final _activityDetailProvider = FutureProvider.autoDispose
    .family<ActivityModel?, String>((ref, id) {
      return ref.watch(activityRepositoryProvider).byId(id);
    });

/// Live roster for the avatar stack. Rendered faces always come from this provider — never from bundled stock photos.
final _rosterProvider = FutureProvider.autoDispose
    .family<List<ActivityParticipant>, String>((ref, activityId) {
      return ref.watch(activityRepositoryProvider).participants(activityId);
    });

// Screen.

class ActivityDetailScreen extends ConsumerWidget {
  const ActivityDetailScreen({super.key, required this.activityId});
  final String activityId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(_activityDetailProvider(activityId));
    // System back on a go-opened detail (deep link, restored route) would otherwise close the app.
    return SystemBackFallback(
      onEmptyStack: (context) => context.go('/discovery'),
      child: async.when(
        loading: () => const DetailLoadingSkeleton(),
        error: (e, _) => AppScaffold(
          showHomeIndicator:
              false, // inside ShellRoute — AppShell draws its own.
          body: ErrorRetry(
            message: 'Could not load activity details.',
            onRetry: () => ref.invalidate(_activityDetailProvider(activityId)),
          ),
        ),
        data: (activity) {
          if (activity == null) {
            return AppScaffold(
              showHomeIndicator:
                  false, // inside ShellRoute — AppShell draws its own.
              body: Center(
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
                            onTap: () => _popOrDiscovery(context),
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
                              _activityDetailProvider(activityId),
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
              ),
            );
          }
          return _DetailBody(activity: activity, activityId: activityId);
        },
      ),
    );
  }
}

// Detail body.

class _DetailBody extends ConsumerStatefulWidget {
  const _DetailBody({required this.activity, required this.activityId});
  final ActivityModel activity;
  final String activityId;

  @override
  ConsumerState<_DetailBody> createState() => _DetailBodyState();
}

class _DetailBodyState extends ConsumerState<_DetailBody> {
  bool _joining = false;

  /// Tracks a just-sent join request locally so the button flips to "pending" immediately.
  bool _requestPending = false;
  final ScrollController _scrollController = ScrollController();
  bool _hasMoreBelow = true;

  @override
  void initState() {
    super.initState();
    _requestPending = widget.activity.hasPendingRequest;
    _scrollController.addListener(_updateFadeVisibility);
    WidgetsBinding.instance.addPostFrameCallback(
      (_) => _updateFadeVisibility(),
    );
  }

  @override
  void dispose() {
    _scrollController.removeListener(_updateFadeVisibility);
    _scrollController.dispose();
    super.dispose();
  }

  void _updateFadeVisibility() {
    if (!_scrollController.hasClients) return;
    final position = _scrollController.position;
    final atBottom = position.pixels >= position.maxScrollExtent - 4;
    if (atBottom == _hasMoreBelow) {
      setState(() => _hasMoreBelow = !atBottom);
    }
  }

  Future<void> _onJoin() async {
    HapticFeedback.mediumImpact();
    setState(() => _joining = true);
    try {
      // Approval-gated activities file a join request instead of joining outright.
      if (widget.activity.requiresApproval && !_requestPending) {
        await ref
            .read(activityRepositoryProvider)
            .requestJoin(widget.activityId);
        if (!mounted) return;
        HapticFeedback.heavyImpact();
        setState(() => _requestPending = true);
        // Refresh the detail (viewer context now carries the pending request) so a remount renders the pending pill.
        ref.invalidate(_activityDetailProvider(widget.activityId));
        // And the Pending tab, which caches keepAlive-side.
        ref.invalidate(pendingGamesProvider);
        AppSnackbar.show(
          context,
          message: 'Request sent! The host will review it soon.',
          variant: AppSnackbarVariant.success,
        );
        return;
      }
      await ref.read(activityRepositoryProvider).join(widget.activityId);
      if (!mounted) return;
      HapticFeedback.heavyImpact();
      // Upcoming caches keepAlive-side — refresh it now so the game is there when the user opens My Games.
      ref.invalidate(joinedGamesProvider);
      AppSnackbar.show(
        context,
        message: 'You\'ve joined ${widget.activity.title}!',
        variant: AppSnackbarVariant.success,
      );
      // The joined activity rides along as route extra for any downstream screen that accepts cached fallback content.
      NavGuard.push(
        context,
        '/joined-activity/${widget.activityId}',
        extra: widget.activity,
      );
    } catch (e) {
      if (!mounted) return;
      // Surface precise backend rejections ("Activity is full", "Activity has already started") instead of a generic.
      final message = e is DioException && e.error is ApiException
          ? (e.error as ApiException).userMessage
          : (widget.activity.requiresApproval && !_requestPending
                ? 'Could not send request. Please try again.'
                : 'Could not join. Please try again.');
      AppSnackbar.show(
        context,
        message: message,
        variant: AppSnackbarVariant.error,
      );
    } finally {
      if (mounted) setState(() => _joining = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final a = widget.activity;

    // Overlap: the card rises this far into the hero.
    const double overlapAmount = 44;
    const double heroH = _Hero.heroHeight;

    return AppScaffold(
      safeAreaTop: false,
      showHomeIndicator: false, // inside ShellRoute — AppShell draws its own.
      bottomBar: _ActionBar(
        activity: widget.activity,
        joining: _joining,
        requestPending: _requestPending,
        onDislike: () => _popOrDiscovery(context),
        onJoin: _onJoin,
      ),
      body: Stack(
        children: [
          // Layer 1: hero (fixed height, full width).
          SizedBox(
            height: heroH,
            width: double.infinity,
            child: _Hero(activity: a),
          ),

          // ── Layer 2: white card, starts heroH - overlap from top ───── Positioned.fill + top leaves the card.
          Positioned(
            top: heroH - overlapAmount,
            left: 0,
            right: 0,
            bottom: 0,
            child: ShaderMask(
              shaderCallback: (rect) => LinearGradient(
                begin: Alignment.bottomCenter,
                end: Alignment.topCenter,
                colors: _hasMoreBelow
                    ? const [AppColors.scrimTransparent, AppColors.textPrimary]
                    : const [AppColors.textPrimary, AppColors.textPrimary],
                stops: const [0.0, 0.06],
              ).createShader(rect),
              blendMode: BlendMode.dstIn,
              child: Container(
                decoration: BoxDecoration(
                  color: context.colors.surface,
                  borderRadius: const BorderRadius.vertical(
                    top: Radius.circular(AppRadius.xl),
                  ),
                  boxShadow: AppShadows.sheet,
                ),
                child: SingleChildScrollView(
                  controller: _scrollController,
                  // Extra top padding compensates for the overlap so content starts below where the pills hang over.
                  padding: const EdgeInsets.fromLTRB(
                    AppSpacing.x5,
                    AppSpacing.x5,
                    AppSpacing.x5,
                    AppSpacing.x8,
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        a.title,
                        style: AppTypography.headingDisplay(context),
                      ),
                      const SizedBox(height: AppSpacing.x5),
                      _HostCard(
                        hostName: a.hostName,
                        hostId: a.hostId,
                        hostRating: a.hostRating,
                        hostHostRating: a.hostHostRating,
                        hostHostRatingCount: a.hostHostRatingCount,
                      ),
                      const SizedBox(height: AppSpacing.x3),
                      _MetaCard(activity: a),
                      ActivityWeatherSection(activity: a),
                      const SizedBox(height: AppSpacing.x5),
                      // Venue map only when the activity carries coordinates — older rows may not have them.
                      if (a.latitude != null && a.longitude != null) ...[
                        VenueMapCard(activity: a),
                        const SizedBox(height: AppSpacing.x5),
                      ],
                      Text(
                        'About this Activity',
                        style: AppTypography.titleMedium(context),
                      ),
                      const SizedBox(height: AppSpacing.x3),
                      Text(
                        a.description,
                        style: AppTypography.bodyReading(context),
                      ),
                      const SizedBox(height: AppSpacing.x5),
                      _ParticipantsSection(activity: a),
                      const SizedBox(height: AppSpacing.x5),
                      _ReportButton(activity: widget.activity),
                    ],
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

// Hero.
