import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
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
import '../../../core/widgets/app_scaffold.dart';
import '../../../core/widgets/asset_image.dart';
import '../../../core/widgets/app_snackbar.dart';
import '../../../core/widgets/app_tappable.dart';
import '../../../core/widgets/error_retry.dart';
import '../../../core/widgets/label_badge.dart';
import '../../../core/widgets/pressable_scale.dart';
import 'widgets/detail_loading_skeleton.dart';
import '../domain/activity_participant.dart';
import '../../discovery/domain/activity_model.dart';
import 'my_activities_screen.dart';

part 'widgets/manage_hero.dart';
part 'widgets/manage_cards.dart';
part 'widgets/manage_actions.dart';
part 'widgets/manage_share.dart';
part 'widgets/manage_announce.dart';
part 'widgets/manage_participants.dart';
part 'widgets/manage_details.dart';

// Data type.

typedef _ManageData = ({
  ActivityModel activity,
  List<ActivityParticipant> roster,
  List<ActivityParticipant> requests,
});

final _manageProvider = FutureProvider.autoDispose.family<_ManageData, String>((
  ref,
  activityId,
) async {
  final repo = ref.watch(activityRepositoryProvider);
  final activity = await repo.byId(activityId);
  if (activity == null) throw StateError('Activity not found');
  // joinRequests is host-gated server-side; non-hosts (and offline) get an empty list.
  final (roster, requests) = await (
    repo.participants(activityId),
    repo.joinRequests(activityId),
  ).wait;
  return (activity: activity, roster: roster, requests: requests);
});

// Screen.

class ManageActivityScreen extends ConsumerStatefulWidget {
  const ManageActivityScreen({super.key, required this.activityId});
  final String activityId;

  @override
  ConsumerState<ManageActivityScreen> createState() =>
      _ManageActivityScreenState();
}

class _ManageActivityScreenState extends ConsumerState<ManageActivityScreen> {
  /// Uids with an approve/decline decision currently in flight.
  final Set<String> _deciding = {};

  /// Uids with a kick (host removal) currently in flight.
  final Set<String> _kicking = {};

  String get activityId => widget.activityId;

  /// Opens the edit screen; refreshes the detail provider and confirms when the host saved changes.
  Future<void> _openEdit(BuildContext context) async {
    final updated = await NavGuard.pushT<bool>(
      context,
      '/edit-activity/$activityId',
    );
    if (updated != true || !context.mounted) return;
    ref.invalidate(_manageProvider(activityId));
    ref.invalidate(hostedGamesProvider);
    ref.invalidate(joinedGamesProvider);
    AppSnackbar.show(
      context,
      message: 'Activity updated.',
      variant: AppSnackbarVariant.success,
    );
  }

  Future<void> _confirmCancel(BuildContext context) async {
    final confirmed = await AppDialog.confirm(
      context,
      title: 'Cancel Activity?',
      body:
          'This will permanently cancel the activity and notify all participants. This cannot be undone.',
      confirmLabel: 'Cancel Activity',
      cancelLabel: 'Keep it',
      destructive: true,
    );
    if (confirmed != true) return;
    try {
      await ref.read(activityRepositoryProvider).cancel(activityId);
      ref.invalidate(hostedGamesProvider);
      ref.invalidate(joinedGamesProvider);
      ref.invalidate(pastGamesProvider);
      if (!context.mounted) return;
      AppSnackbar.show(
        context,
        message: 'Activity cancelled. Participants have been notified.',
        variant: AppSnackbarVariant.info,
      );
      if (context.mounted) Navigator.of(context).maybePop();
    } catch (e) {
      if (!context.mounted) return;
      AppSnackbar.show(
        context,
        message: 'Could not cancel activity. Please try again.',
        variant: AppSnackbarVariant.error,
      );
    }
  }

  Future<void> _decideRequest(
    BuildContext context,
    String uid,
    String name, {
    required bool approve,
  }) async {
    // Per-row guard: ignore taps while this row's decision is pending.
    if (_deciding.contains(uid)) return;
    setState(() => _deciding.add(uid));
    try {
      final repo = ref.read(activityRepositoryProvider);
      if (approve) {
        await repo.approveJoinRequest(activityId, uid);
      } else {
        await repo.declineJoinRequest(activityId, uid);
      }
      ref.invalidate(_manageProvider(activityId));
      ref.invalidate(pendingGamesProvider);
      ref.invalidate(hostedGamesProvider);
      if (!context.mounted) return;
      AppSnackbar.show(
        context,
        message: approve
            ? '$name approved! They have been notified.'
            : '$name declined.',
        variant: approve ? AppSnackbarVariant.success : AppSnackbarVariant.info,
      );
    } catch (e) {
      if (!context.mounted) return;
      AppSnackbar.show(
        context,
        message: approve
            ? 'Could not approve. The activity may be full.'
            : 'Could not decline. Please try again.',
        variant: AppSnackbarVariant.error,
      );
    } finally {
      if (mounted) setState(() => _deciding.remove(uid));
    }
  }

  Future<void> _kickParticipant(
    BuildContext context,
    String uid,
    String name,
  ) async {
    // Per-row guard: ignore taps while this row's kick is pending.
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
      ref.invalidate(_manageProvider(activityId));
      ref.invalidate(hostedGamesProvider);
      ref.invalidate(joinedGamesProvider);
      if (!context.mounted) return;
      AppSnackbar.show(
        context,
        message: '$name removed from the activity.',
        variant: AppSnackbarVariant.info,
      );
    } catch (e) {
      if (!context.mounted) return;
      AppSnackbar.show(
        context,
        message: 'Could not remove $name. Please try again.',
        variant: AppSnackbarVariant.error,
      );
    } finally {
      if (mounted) setState(() => _kicking.remove(uid));
    }
  }

  Future<void> _confirmComplete(BuildContext context) async {
    final confirmed = await AppDialog.confirm(
      context,
      title: 'Mark as Completed?',
      body:
          'This closes the activity so no one else can join. You can still see it in your history.',
      confirmLabel: 'Mark Completed',
      cancelLabel: 'Not yet',
    );
    if (confirmed != true) return;
    try {
      await ref
          .read(activityRepositoryProvider)
          .updateStatus(activityId, 'completed');
      ref.invalidate(hostedGamesProvider);
      ref.invalidate(joinedGamesProvider);
      ref.invalidate(pastGamesProvider);
      if (!context.mounted) return;
      AppSnackbar.show(
        context,
        message: 'Activity marked as completed.',
        variant: AppSnackbarVariant.success,
      );
      if (context.mounted) Navigator.of(context).maybePop();
    } catch (e) {
      if (!context.mounted) return;
      AppSnackbar.show(
        context,
        message: 'Could not update activity. Please try again.',
        variant: AppSnackbarVariant.error,
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final async = ref.watch(_manageProvider(activityId));

    return AppScaffold(
      safeAreaTop: false,
      backgroundColor: context.colors.background,
      showHomeIndicator: false,
      body: async.when(
        loading: () => const DetailLoadingSkeleton(bottomBar: false),
        error: (_, _) => ErrorRetry(
          message: 'Could not load this activity.',
          onRetry: () => ref.invalidate(_manageProvider(activityId)),
        ),
        data: (data) => _ManageBody(
          activityId: activityId,
          activity: data.activity,
          roster: data.roster,
          requests: data.requests,
          deciding: _deciding,
          kicking: _kicking,
          onEdit: () => _openEdit(context),
          onCancel: () => _confirmCancel(context),
          onComplete: () => _confirmComplete(context),
          onApprove: (uid, name) =>
              _decideRequest(context, uid, name, approve: true),
          onDecline: (uid, name) =>
              _decideRequest(context, uid, name, approve: false),
          onKick: (uid, name) => _kickParticipant(context, uid, name),
        ),
      ),
    );
  }
}

// Body.
