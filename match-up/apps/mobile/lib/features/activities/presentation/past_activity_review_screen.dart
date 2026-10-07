import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../core/providers/profile_providers.dart';
import '../../../core/providers/repository_providers.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/theme/dark_colors.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/widgets/app_avatar.dart';
import '../../../core/widgets/app_scaffold.dart';
import '../../../core/widgets/asset_image.dart';
import '../../../core/widgets/app_snackbar.dart';
import '../../../core/widgets/app_tappable.dart';
import '../../../core/widgets/error_retry.dart';
import '../../../core/widgets/pressable_scale.dart';
import '../../../core/widgets/skeleton.dart';
import '../../ratings/domain/rating_models.dart';
import '../../report/presentation/report_user_sheet.dart';
import '../domain/activity_participant.dart';
import '../../discovery/domain/activity_model.dart';

// Data.

typedef _ReviewData = ({
  ActivityModel activity,
  List<ActivityParticipant> participants,
});

final _reviewDataProvider = FutureProvider.autoDispose
    .family<_ReviewData, String>((ref, activityId) async {
      final repo = ref.watch(activityRepositoryProvider);
      final activity = await repo.byId(activityId);
      if (activity == null) throw StateError('Activity not found');
      final participants = await repo.participants(activityId);
      return (activity: activity, participants: participants);
    });

/// Whether the viewer already rated this activity.
final _ratedProvider = FutureProvider.autoDispose.family<bool, String>((
  ref,
  activityId,
) async {
  return ref.watch(ratingsRepositoryProvider).hasRated(activityId);
});

// Screen.

class PastActivityReviewScreen extends ConsumerStatefulWidget {
  const PastActivityReviewScreen({super.key, required this.activityId});
  final String activityId;

  @override
  ConsumerState<PastActivityReviewScreen> createState() =>
      _PastActivityReviewScreenState();
}

class _PastActivityReviewScreenState
    extends ConsumerState<PastActivityReviewScreen> {
  int _stars = 4;
  final _commentController = TextEditingController();

  /// userId → star rating (1–5). Empty until user rates that participant.
  final Map<String, int> _participantRatings = {};
  bool _submitting = false;

  @override
  void initState() {
    super.initState();
    // Re-evaluate [_canSubmit] as the comment is typed.
    _commentController.addListener(_onCommentChanged);
  }

  void _onCommentChanged() {
    if (mounted) setState(() {});
  }

  @override
  void dispose() {
    _commentController.removeListener(_onCommentChanged);
    _commentController.dispose();
    super.dispose();
  }

  bool _canSubmit() {
    if (_stars < 1) return false;
    if (_commentController.text.trim().isNotEmpty) return true;
    return _participantRatings.isNotEmpty;
  }

  Future<void> _submit({
    required String sportType,
    required List<ActivityParticipant> participants,
  }) async {
    if (_submitting) return;
    final repo = ref.read(ratingsRepositoryProvider);
    // Defensive self-exclusion — the visible list is already filtered.
    final myUid = ref.read(myProfileProvider).valueOrNull?.id;

    final trimmedComment = _commentController.text.trim();
    final comment = trimmedComment.isEmpty ? null : trimmedComment;

    final rated = participants
        .where((p) => _participantRatings.containsKey(p.userId))
        .where((p) => myUid == null || p.userId != myUid)
        .map(
          (p) => ParticipantRatingSubmission(
            rateeUserId: p.userId,
            stars: _participantRatings[p.userId]!,
          ),
        )
        .toList();

    setState(() => _submitting = true);

    final submission = ActivityRatingSubmission(
      activityId: widget.activityId,
      activitySportType: sportType,
      activityStars: _stars,
      participants: rated,
      comment: comment,
    );

    try {
      final result = await repo.submitActivityRating(submission);
      if (!mounted) return;
      if (result.accepted) {
        // Flip the rated flag so a revisit shows "Update Review".
        ref.invalidate(_ratedProvider(widget.activityId));
        AppSnackbar.show(
          context,
          message: 'Review submitted!',
          variant: AppSnackbarVariant.success,
        );
        Navigator.of(context).pop();
      } else {
        AppSnackbar.show(
          context,
          message: 'Couldn\'t submit review. ${result.remoteError ?? ''}',
          variant: AppSnackbarVariant.error,
        );
        setState(() => _submitting = false);
      }
    } catch (e) {
      if (!mounted) return;
      AppSnackbar.show(
        context,
        message: 'Network error. Please try again.',
        variant: AppSnackbarVariant.error,
      );
      setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final async = ref.watch(_reviewDataProvider(widget.activityId));
    // Already-rated state loads in parallel.
    final ratedAsync = ref.watch(_ratedProvider(widget.activityId));
    final ratedLoading = ratedAsync.isLoading;
    final alreadyRated = ratedAsync.valueOrNull ?? false;
    // Current user is never rateable (UX mirror of the backend self-rating rejection).
    final myUid = ref.watch(myProfileProvider).valueOrNull?.id;

    return AppScaffold(
      safeAreaTop: true,
      showHomeIndicator: false,
      backgroundColor: context.colors.background,
      body: async.when(
        loading: () => const SkeletonList(count: 4),
        error: (_, _) => ErrorRetry(
          message: 'Could not load this activity.',
          onRetry: () => ref.invalidate(_reviewDataProvider(widget.activityId)),
        ),
        data: (data) {
          // The host is rateable too, but isn't guaranteed a roster row (hosts don't always carry a participant doc).
          final withHost =
              data.participants.any((p) => p.userId == data.activity.hostId)
              ? data.participants
              : [
                  ...data.participants,
                  if (data.activity.hostId.isNotEmpty)
                    ActivityParticipant(
                      userId: data.activity.hostId,
                      name: data.activity.hostName.isNotEmpty
                          ? data.activity.hostName
                          : 'Host',
                      skillLevel: data.activity.skillLevel,
                      joinedAt: data.activity.dateTime,
                      isOrganizer: true,
                    ),
                ];
          final rateable = myUid == null
              ? withHost
              : withHost.where((p) => p.userId != myUid).toList();
          final submitLabel = ratedLoading
              ? 'Loading…'
              : alreadyRated
              ? 'Update Review'
              : 'Submit Review';
          // Called-off games land here from the Past tab too, but there is nothing to rate.
          final isCancelled =
              data.activity.lifecycleStatus.toLowerCase() == 'cancelled';
          if (isCancelled) {
            return Column(
              children: [
                const _Header(title: 'Past Activity'),
                Expanded(
                  child: SingleChildScrollView(
                    padding: const EdgeInsets.fromLTRB(
                      AppSpacing.x5,
                      AppSpacing.x4,
                      AppSpacing.x5,
                      AppSpacing.x6,
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        _SummaryCard(activity: data.activity),
                        const SizedBox(height: AppSpacing.x5),
                        const _CancelledNotice(),
                      ],
                    ),
                  ),
                ),
              ],
            );
          }
          return Column(
            children: [
              // Header
              const _Header(),
              // Scrollable content
              Expanded(
                child: SingleChildScrollView(
                  padding: const EdgeInsets.fromLTRB(
                    AppSpacing.x5,
                    AppSpacing.x4,
                    AppSpacing.x5,
                    AppSpacing.x6,
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Activity summary card
                      _SummaryCard(activity: data.activity),
                      const SizedBox(height: AppSpacing.x5),

                      // Already-rated notice — resubmitting edits the previous review (backend upserts).
                      if (alreadyRated) ...[
                        _RatedNotice(),
                        const SizedBox(height: AppSpacing.x5),
                      ],

                      // Star rating + comment
                      _RateActivitySection(
                        stars: _stars,
                        onStarTap: (i) => setState(() => _stars = i),
                        commentController: _commentController,
                      ),
                      const SizedBox(height: AppSpacing.x5),

                      // Rate participants
                      _RateParticipantsSection(
                        participants: rateable,
                        ratings: _participantRatings,
                        onRate: (id, stars) =>
                            setState(() => _participantRatings[id] = stars),
                      ),
                      const SizedBox(height: AppSpacing.x2),
                    ],
                  ),
                ),
              ),

              // Pinned submit button — loading disables with "Loading…", "Update" wording when a previous review.
              _SubmitBar(
                submitting: _submitting || ratedLoading,
                label: submitLabel,
                onTap: !ratedLoading && _canSubmit()
                    ? () => _submit(
                        sportType: data.activity.sportType,
                        participants: rateable,
                      )
                    : null,
              ),
            ],
          );
        },
      ),
    );
  }
}

// Header.

class _Header extends StatelessWidget {
  const _Header({this.title = 'Activity Review'});
  final String title;

  @override
  Widget build(BuildContext context) {
    return Container(
      color: context.colors.surface,
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.x4,
        AppSpacing.x3,
        AppSpacing.x5,
        AppSpacing.x3,
      ),
      child: Row(
        children: [
          Semantics(
            button: true,
            label: 'Back',
            child: PressableScale(
              onTap: () => Navigator.of(context).maybePop(),
              child: Container(
                width: 38,
                height: 38,
                decoration: BoxDecoration(
                  color: context.colors.surface,
                  borderRadius: BorderRadius.circular(AppRadius.sm),
                  border: Border.all(color: context.colors.border),
                  boxShadow: AppShadows.card,
                ),
                alignment: Alignment.center,
                child: Icon(
                  Icons.arrow_back_ios_new_rounded,
                  size: 16,
                  color: context.colors.textPrimary,
                ),
              ),
            ),
          ),
          const SizedBox(width: AppSpacing.x3),
          Expanded(
            child: Text(
              title,
              style: AppTypography.titleSheet(context),
              textAlign: TextAlign.center,
            ),
          ),
          // Mirror spacer so title is centred
          const SizedBox(width: 38),
        ],
      ),
    );
  }
}

// Summary card.

class _SummaryCard extends StatelessWidget {
  const _SummaryCard({required this.activity});
  final ActivityModel activity;

  @override
  Widget build(BuildContext context) {
    final dateFmt = DateFormat("EEE, MMM d '•' h:mm a");

    return Container(
      padding: const EdgeInsets.all(AppSpacing.x4),
      decoration: BoxDecoration(
        color: context.colors.surface,
        borderRadius: BorderRadius.circular(AppRadius.card),
        border: Border.all(color: context.colors.border),
        boxShadow: AppShadows.card,
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Thumbnail
          ClipRRect(
            borderRadius: BorderRadius.circular(AppRadius.input),
            child: activity.coverImageUrl != null
                ? AssetImageWithFallback(
                    imagePath: activity.coverImageUrl!,
                    width: 72,
                    height: 72,
                    fit: BoxFit.cover,
                  )
                : _thumbPlaceholder(),
          ),
          const SizedBox(width: AppSpacing.x3),

          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Badges row
                Row(
                  children: [
                    _Pill(
                      label: activity.sportType.toUpperCase(),
                      bgColor: context.colors.primarySoft,
                      textColor: context.colors.primaryOnSurface,
                    ),
                    const SizedBox(width: AppSpacing.x2),
                    _Pill(
                      label: 'COMPLETED',
                      bgColor: context.colors.surfaceMuted,
                      textColor: context.colors.textSecondary,
                    ),
                  ],
                ),
                const SizedBox(height: AppSpacing.x2),

                // Title
                Text(
                  activity.title,
                  style: AppTypography.labelField(
                    context,
                  ).copyWith(fontSize: 15),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 4),

                // Date
                Row(
                  children: [
                    Icon(
                      Icons.access_time_rounded,
                      size: 13,
                      color: context.colors.textTertiary,
                    ),
                    const SizedBox(width: 4),
                    Text(
                      dateFmt.format(activity.dateTime),
                      style: AppTypography.metaSub(context),
                    ),
                  ],
                ),
                const SizedBox(height: 4),

                // Location
                Row(
                  children: [
                    Icon(
                      Icons.place_outlined,
                      size: 13,
                      color: context.colors.textTertiary,
                    ),
                    const SizedBox(width: 4),
                    Expanded(
                      child: Text(
                        activity.location,
                        style: AppTypography.metaSub(context),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _thumbPlaceholder() => Container(
    width: 72,
    height: 72,
    decoration: const BoxDecoration(
      gradient: LinearGradient(
        colors: [AppColors.primary, AppColors.primaryDark],
      ),
    ),
    alignment: Alignment.center,
    child: Icon(
      Icons.sports,
      size: 28,
      color: AppColors.textOnPrimary.withValues(alpha: 0.5),
    ),
  );
}

class _Pill extends StatelessWidget {
  const _Pill({
    required this.label,
    required this.bgColor,
    required this.textColor,
  });
  final String label;
  final Color bgColor;
  final Color textColor;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: BorderRadius.circular(AppRadius.xs),
      ),
      child: Text(
        label,
        style: AppTypography.chipLabel(
          context,
        ).copyWith(fontSize: 10, color: textColor),
      ),
    );
  }
}

// Rate activity section.

class _RateActivitySection extends StatelessWidget {
  const _RateActivitySection({
    required this.stars,
    required this.onStarTap,
    required this.commentController,
  });

  final int stars;
  final ValueChanged<int> onStarTap;
  final TextEditingController commentController;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('Rate this activity', style: AppTypography.titleMedium(context)),
        const SizedBox(height: AppSpacing.x4),

        // Stars — centered
        Center(
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: List.generate(5, (i) {
              final filled = i < stars;
              return Semantics(
                button: true,
                label: '${i + 1} star${i == 0 ? '' : 's'}',
                child: AppTappable(
                  semanticLabel: '${i + 1} stars',
                  feedback: AppTapFeedback.scale,
                  onTap: () => onStarTap(i + 1),
                  minSize: 44,
                  child: Icon(
                    filled ? Icons.star_rounded : Icons.star_border_rounded,
                    size: 36,
                    color: filled
                        ? context.colors.warningText
                        : context.colors.textTertiary,
                  ),
                ),
              );
            }),
          ),
        ),
        const SizedBox(height: AppSpacing.x4),

        // Comment label
        Text(
          'COMMENT',
          style: AppTypography.metaSub(context).copyWith(
            fontSize: 11,
            fontWeight: FontWeight.w700,
            letterSpacing: 0.8,
          ),
        ),
        const SizedBox(height: AppSpacing.x2),

        // Comment field
        Container(
          decoration: BoxDecoration(
            color: context.colors.surface,
            borderRadius: BorderRadius.circular(AppRadius.card),
            border: Border.all(color: context.colors.border),
          ),
          padding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.x4,
            vertical: AppSpacing.x3,
          ),
          child: TextField(
            controller: commentController,
            minLines: 3,
            maxLines: 5,
            maxLength: 500,
            cursorColor: AppColors.primary,
            cursorWidth: 1.5,
            style: AppTypography.bodyReading(context),
            decoration: InputDecoration(
              hintText: 'Share your experience...',
              hintStyle: AppTypography.bodyReading(
                context,
              ).copyWith(color: context.colors.textTertiary),
              filled: true,
              fillColor: Colors.transparent,
              border: InputBorder.none,
              enabledBorder: InputBorder.none,
              focusedBorder: InputBorder.none,
              isDense: true,
              contentPadding: EdgeInsets.zero,
              counterStyle: AppTypography.metaSub(context),
            ),
          ),
        ),
      ],
    );
  }
}

// Rate participants section.

class _RateParticipantsSection extends StatelessWidget {
  const _RateParticipantsSection({
    required this.participants,
    required this.ratings,
    required this.onRate,
  });

  final List<ActivityParticipant> participants;
  final Map<String, int> ratings;
  final void Function(String userId, int stars) onRate;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('Rate participants', style: AppTypography.titleMedium(context)),
        const SizedBox(height: AppSpacing.x1),
        Text(
          'Your ratings are anonymous and help others find great teammates.',
          style: AppTypography.metaSub(context),
        ),
        const SizedBox(height: AppSpacing.x3),
        if (participants.isEmpty)
          Text('No one else to rate', style: AppTypography.metaSub(context))
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
                for (var i = 0; i < participants.length; i++) ...[
                  _ParticipantRow(
                    item: participants[i],
                    stars: ratings[participants[i].userId] ?? 0,
                    onRate: (s) => onRate(participants[i].userId, s),
                  ),
                  if (i < participants.length - 1)
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
    required this.stars,
    required this.onRate,
  });

  final ActivityParticipant item;
  final int stars; // 0 = not yet rated
  final ValueChanged<int> onRate;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.x4,
        vertical: AppSpacing.x3,
      ),
      child: Row(
        children: [
          // Avatar — backend photo when present, initials otherwise.
          AppAvatar(
            imageUrl: item.avatarUrl,
            name: item.name,
            size: AppAvatarSize.md,
          ),
          const SizedBox(width: AppSpacing.x3),

          // Name + skill
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(item.name, style: AppTypography.labelField(context)),
                Text(item.skillLevel, style: AppTypography.metaSub(context)),
              ],
            ),
          ),

          // 5-star mini row
          Row(
            mainAxisSize: MainAxisSize.min,
            children: List.generate(5, (i) {
              final filled = i < stars;
              return Semantics(
                button: true,
                label: '${i + 1} star${i == 0 ? '' : 's'} for ${item.name}',
                child: AppTappable(
                  semanticLabel: '${i + 1} stars',
                  feedback: AppTapFeedback.scale,
                  onTap: () => onRate(i + 1),
                  minSize: 32,
                  child: Icon(
                    filled ? Icons.star_rounded : Icons.star_border_rounded,
                    size: 22,
                    color: filled
                        ? context.colors.warningText
                        : context.colors.textTertiary,
                  ),
                ),
              );
            }),
          ),

          // Report — same sheet as profile/DM, reachable right where the bad experience happened.
          if (item.userId.isNotEmpty)
            AppTappable(
              semanticLabel: 'Report ${item.name}',
              feedback: AppTapFeedback.scale,
              minSize: 36,
              onTap: () => ReportUserSheet.show(
                context,
                userId: item.userId,
                userName: item.name,
              ),
              child: Padding(
                padding: const EdgeInsets.all(6),
                child: Icon(
                  Icons.flag_outlined,
                  size: 18,
                  color: context.colors.textTertiary,
                ),
              ),
            ),
        ],
      ),
    );
  }
}

// Submit bar.

/// Shown when the viewer already rated — resubmitting edits.
class _CancelledNotice extends StatelessWidget {
  const _CancelledNotice();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(AppSpacing.x4),
      decoration: BoxDecoration(
        color: context.colors.errorLight,
        borderRadius: BorderRadius.circular(AppRadius.card),
        border: Border.all(
          color: context.colors.errorText.withValues(alpha: 0.25),
        ),
      ),
      child: Row(
        children: [
          Icon(
            Icons.event_busy_outlined,
            size: 20,
            color: context.colors.errorText,
          ),
          const SizedBox(width: AppSpacing.x3),
          Expanded(
            child: Text(
              'This game was cancelled, so there is nothing to review.',
              style: AppTypography.metaSub(context).copyWith(fontSize: 13),
            ),
          ),
        ],
      ),
    );
  }
}

class _RatedNotice extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(AppSpacing.x4),
      decoration: BoxDecoration(
        color: context.colors.primarySoft,
        borderRadius: BorderRadius.circular(AppRadius.card),
        border: Border.all(
          color: context.colors.primaryOnSurface.withValues(alpha: 0.25),
        ),
      ),
      child: Row(
        children: [
          Icon(
            Icons.info_outline_rounded,
            size: 20,
            color: context.colors.primaryOnSurface,
          ),
          const SizedBox(width: AppSpacing.x3),
          Expanded(
            child: Text(
              'You already reviewed this activity. Submitting again updates your review.',
              style: AppTypography.metaSub(context).copyWith(fontSize: 13),
            ),
          ),
        ],
      ),
    );
  }
}

class _SubmitBar extends StatelessWidget {
  const _SubmitBar({
    required this.onTap,
    required this.submitting,
    required this.label,
  });

  /// `null` disables the button (greyed-out state, no press feedback).
  final VoidCallback? onTap;

  /// When true, the button shows a spinner instead of the label and ignores taps.
  final bool submitting;

  /// "Submit Review" for fresh reviews, "Update Review" for edits.
  final String label;

  @override
  Widget build(BuildContext context) {
    final enabled = onTap != null && !submitting;
    return Container(
      padding: EdgeInsets.fromLTRB(
        AppSpacing.x5,
        AppSpacing.x3,
        AppSpacing.x5,
        AppSpacing.x5 + MediaQuery.of(context).viewPadding.bottom,
      ),
      decoration: BoxDecoration(
        color: context.colors.surface,
        boxShadow: AppShadows.bottomBar,
      ),
      child: PressableScale(
        onTap: enabled ? onTap : null,
        child: Container(
          width: double.infinity,
          padding: const EdgeInsets.symmetric(vertical: AppSpacing.x4),
          decoration: BoxDecoration(
            color: enabled ? AppColors.primary : context.colors.surfaceMuted,
            borderRadius: BorderRadius.circular(AppRadius.pill),
            boxShadow: enabled ? AppShadows.glowPrimary : null,
          ),
          alignment: Alignment.center,
          child: submitting
              ? const SizedBox(
                  width: 20,
                  height: 20,
                  child: CircularProgressIndicator(
                    strokeWidth: 2.4,
                    color: AppColors.textOnPrimary,
                  ),
                )
              : Text(
                  label,
                  style: AppTypography.buttonPrimary.copyWith(
                    color: enabled
                        ? AppColors.textOnPrimary
                        : context.colors.textTertiary,
                  ),
                ),
        ),
      ),
    );
  }
}
