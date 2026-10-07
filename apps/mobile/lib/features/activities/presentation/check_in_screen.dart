// GPS check-in: two on-device gates at tap time — time window (30 min early) + venue proximity (200 m).

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';
import 'package:intl/intl.dart';

import '../../../core/providers/repository_providers.dart';
import '../../../core/services/location_service.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/utils/share_helper.dart';
import '../../../core/theme/dark_colors.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/utils/geo.dart';
import '../../../core/widgets/app_scaffold.dart';
import '../../../core/widgets/app_snackbar.dart';
import '../../../core/widgets/asset_image.dart';
import '../../../core/widgets/app_tappable.dart';
import '../../../core/widgets/error_retry.dart';
import '../../../core/widgets/pressable_scale.dart';
import '../../../core/widgets/skeleton.dart';
import '../../discovery/domain/activity_model.dart';
import 'my_activities_screen.dart';

// Provider.

final _checkInActivityProvider = FutureProvider.autoDispose
    .family<ActivityModel, String>((ref, activityId) async {
      final activity = await ref
          .watch(activityRepositoryProvider)
          .byId(activityId);
      if (activity == null) throw StateError('Activity not found');
      return activity;
    });

// Status enum.

enum _CheckInStatus { notCheckedIn, locating, checkedIn, locationDenied }

// Check in policy.
// Two gates, both enforced on-device at tap time: Time window.

/// How close (metres) the device must be to the venue to check in.
const double _checkInRadiusM = 200;

/// How early before the scheduled start check-in opens.
const Duration _checkInWindow = Duration(minutes: 30);

/// Why check-in is (not) currently allowed.
class _Gate {
  const _Gate({
    required this.canCheckIn,
    required this.icon,
    required this.title,
    required this.body,
  });
  final bool canCheckIn;
  final IconData icon;
  final String title;
  final String body;
}

_Gate _gateFor(ActivityModel activity, Position? position) {
  final now = DateTime.now();
  final opensAt = activity.dateTime.subtract(_checkInWindow);

  if (now.isAfter(activity.endTime)) {
    return const _Gate(
      canCheckIn: false,
      icon: Icons.event_busy_rounded,
      title: 'Check-in closed',
      body: 'This activity has already ended.',
    );
  }
  if (now.isBefore(opensAt)) {
    final opensStr = DateFormat('h:mm a').format(opensAt);
    return _Gate(
      canCheckIn: false,
      icon: Icons.access_time_rounded,
      title: 'Not open yet',
      body: 'Check-in opens at $opensStr (30 minutes before the start).',
    );
  }
  if (position == null) {
    return const _Gate(
      canCheckIn: false,
      icon: Icons.location_off_rounded,
      title: 'Location needed',
      body: 'We could not get your location. Tap "Refresh my location" below.',
    );
  }
  final lat = activity.latitude;
  final lng = activity.longitude;
  if (lat == null || lng == null) {
    // No venue coordinates to verify against — the proximity gate is intentionally skipped and the time gate alone.
    return const _Gate(
      canCheckIn: true,
      icon: Icons.check_circle_outline_rounded,
      title: 'Ready to check in',
      body:
          'Venue location not set — time check only. Tap "Check In" below to confirm your attendance.',
    );
  }
  final distanceM =
      haversineKm(position.latitude, position.longitude, lat, lng) * 1000;
  if (distanceM > _checkInRadiusM) {
    return _Gate(
      canCheckIn: false,
      icon: Icons.place_outlined,
      title: 'You are not at the venue yet',
      body:
          'You are ${_formatDistance(distanceM)} away — head to the venue to check in.',
    );
  }
  return const _Gate(
    canCheckIn: true,
    icon: Icons.check_circle_outline_rounded,
    title: 'You are at the venue',
    body: 'Tap "Check In" below to confirm your attendance.',
  );
}

String _formatDistance(double metres) {
  if (metres < 1000) return '${metres.round()} m';
  return '${(metres / 1000).toStringAsFixed(1)} km';
}

// Screen.

class CheckInScreen extends ConsumerStatefulWidget {
  const CheckInScreen({super.key, required this.activityId});
  final String activityId;

  @override
  ConsumerState<CheckInScreen> createState() => _CheckInScreenState();
}

class _CheckInScreenState extends ConsumerState<CheckInScreen> {
  _CheckInStatus _status = _CheckInStatus.locating;
  Position? _position;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _restoreCheckIn();
      _resolveLocation();
    });
  }

  /// Restores already-persisted check-in state so a returning user sees "Checked in" immediately instead of being.
  Future<void> _restoreCheckIn() async {
    try {
      final checkedIn = await ref
          .read(activityRepositoryProvider)
          .isCheckedIn(widget.activityId);
      if (!mounted || !checkedIn) return;
      setState(() => _status = _CheckInStatus.checkedIn);
    } catch (_) {
      // Offline / backend unreachable — stay in the gate flow.
    }
  }

  /// Resolves the device position once (initial load + manual refresh).
  Future<void> _resolveLocation() async {
    Position? pos;
    try {
      pos = await LocationService.instance.getCurrentLocation();
    } on LocationTimeoutException {
      pos = null;
    }
    if (!mounted) return;
    setState(() {
      _position = pos;
      if (_status == _CheckInStatus.locating) {
        _status = pos == null
            ? _CheckInStatus.locationDenied
            : _CheckInStatus.notCheckedIn;
      }
    });
  }

  Future<void> _onCheckIn() async {
    final activity = ref
        .read(_checkInActivityProvider(widget.activityId))
        .valueOrNull;
    if (activity == null || !mounted) return;
    setState(() => _status = _CheckInStatus.locating);
    // Fresh fix at tap time — the cached one may be stale.
    Position? pos;
    try {
      pos = await LocationService.instance.getCurrentLocation();
    } on LocationTimeoutException {
      if (!mounted) return;
      setState(() => _status = _CheckInStatus.notCheckedIn);
      AppSnackbar.show(
        context,
        message: "Couldn't get your location. Try again.",
        variant: AppSnackbarVariant.error,
      );
      return;
    }
    if (!mounted) return;
    final effective = pos ?? _position;
    final gate = _gateFor(activity, effective);
    if (!gate.canCheckIn) {
      setState(() {
        _position = effective;
        _status = effective == null
            ? _CheckInStatus.locationDenied
            : _CheckInStatus.notCheckedIn;
      });
      if (mounted) {
        AppSnackbar.show(
          context,
          message: gate.body,
          variant: AppSnackbarVariant.warning,
        );
      }
      return;
    }
    // Gate passed — persist server-side before flipping to checkedIn.
    try {
      await ref
          .read(activityRepositoryProvider)
          .checkIn(
            activityId: widget.activityId,
            latitude: effective?.latitude,
            longitude: effective?.longitude,
          );
      ref.invalidate(joinedGamesProvider);
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _position = effective;
        _status = _CheckInStatus.notCheckedIn;
      });
      AppSnackbar.show(
        context,
        message: 'Could not check in. Please try again.',
        variant: AppSnackbarVariant.error,
      );
      return;
    }
    if (!mounted) return;
    setState(() {
      _position = effective;
      _status = _CheckInStatus.checkedIn;
    });
  }

  Future<void> _onRefresh() async {
    if (_status == _CheckInStatus.checkedIn) {
      if (mounted) {
        AppSnackbar.show(
          context,
          message: 'Already checked in',
          variant: AppSnackbarVariant.info,
        );
      }
      return;
    }
    setState(() => _status = _CheckInStatus.locating);
    await _resolveLocation();
  }

  @override
  Widget build(BuildContext context) {
    final async = ref.watch(_checkInActivityProvider(widget.activityId));

    return AppScaffold(
      safeAreaTop: false,
      showHomeIndicator: false,
      backgroundColor: context.colors.background,
      body: async.when(
        loading: () => const SkeletonList(count: 3),
        error: (_, _) => ErrorRetry(
          message: 'Could not load this activity.',
          onRetry: () =>
              ref.invalidate(_checkInActivityProvider(widget.activityId)),
        ),
        data: (activity) => _Body(
          activity: activity,
          status: _status,
          position: _position,
          onCheckIn: _onCheckIn,
          onRefresh: _onRefresh,
        ),
      ),
    );
  }
}

// Body.

class _Body extends StatelessWidget {
  const _Body({
    required this.activity,
    required this.status,
    required this.position,
    required this.onCheckIn,
    required this.onRefresh,
  });

  final ActivityModel activity;
  final _CheckInStatus status;
  final Position? position;
  final Future<void> Function() onCheckIn;
  final Future<void> Function() onRefresh;

  static const double _heroHeight = 280;
  static const double _overlapAmount = 44;

  @override
  Widget build(BuildContext context) {
    // Compute the gate once per build and pass it down.
    final gate = _gateFor(activity, position);
    return Column(
      children: [
        Expanded(
          child: Stack(
            children: [
              // Hero.
              SizedBox(
                height: _heroHeight,
                width: double.infinity,
                child: _Hero(activity: activity),
              ),

              // White card.
              Positioned(
                top: _heroHeight - _overlapAmount,
                left: 0,
                right: 0,
                bottom: 0,
                child: SingleChildScrollView(
                  child: Container(
                    decoration: BoxDecoration(
                      color: context.colors.surface,
                      borderRadius: const BorderRadius.vertical(
                        top: Radius.circular(AppRadius.xl),
                      ),
                      boxShadow: AppShadows.sheet,
                    ),
                    padding: const EdgeInsets.fromLTRB(
                      AppSpacing.x5,
                      AppSpacing.x5,
                      AppSpacing.x5,
                      AppSpacing.x6,
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // Title
                        Text(
                          activity.title,
                          style: AppTypography.headingDisplay(context),
                        ),
                        const SizedBox(height: AppSpacing.x2),

                        // Time — blue with clock icon
                        Row(
                          children: [
                            Icon(
                              Icons.access_time_rounded,
                              size: 16,
                              color: context.colors.primaryOnSurface,
                            ),
                            const SizedBox(width: 6),
                            Text(
                              _formatTime(activity.dateTime),
                              style: AppTypography.labelField(context).copyWith(
                                color: context.colors.primaryOnSurface,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: AppSpacing.x5),

                        // Activity details section
                        Text(
                          'Activity Details',
                          style: AppTypography.titleMedium(context),
                        ),
                        const SizedBox(height: AppSpacing.x3),
                        _DetailsCard(activity: activity),
                        const SizedBox(height: AppSpacing.x4),

                        // Status panel — reflects the live gate (time window + proximity), not just tap state.
                        _StatusPanel(status: status, gate: gate),
                        const SizedBox(height: AppSpacing.x4),

                        // Check In button — enabled only when the gate is green.
                        _CheckInButton(
                          status: status,
                          enabled: gate.canCheckIn,
                          onCheckIn: onCheckIn,
                        ),
                        const SizedBox(height: AppSpacing.x3),

                        // Refresh my location link
                        if (status != _CheckInStatus.checkedIn)
                          Center(
                            child: AppTappable(
                              semanticLabel: 'Refresh my location',
                              feedback: AppTapFeedback.scale,
                              onTap: onRefresh,
                              minSize: 44,
                              child: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Icon(
                                    Icons.refresh_rounded,
                                    size: 16,
                                    color: context.colors.primaryOnSurface,
                                  ),
                                  const SizedBox(width: 6),
                                  Text(
                                    'Refresh my location',
                                    style: AppTypography.labelField(context)
                                        .copyWith(
                                          color:
                                              context.colors.primaryOnSurface,
                                          fontSize: 14,
                                        ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                      ],
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  String _formatTime(DateTime dt) {
    final now = DateTime.now();
    final isToday =
        dt.year == now.year && dt.month == now.month && dt.day == now.day;
    final prefix = isToday ? 'Today' : DateFormat('EEE, MMM d').format(dt);
    final time = DateFormat('h:mm a').format(dt);
    return '$prefix, $time';
  }
}

// Hero.

class _Hero extends StatelessWidget {
  const _Hero({required this.activity});
  final ActivityModel activity;

  @override
  Widget build(BuildContext context) {
    return Stack(
      fit: StackFit.expand,
      children: [
        // Cover image (bundled asset or remote Storage URL)
        activity.coverImageUrl != null
            ? AssetImageWithFallback(
                imagePath: activity.coverImageUrl!,
                fit: BoxFit.cover,
              )
            : _placeholder(),

        // Bottom gradient scrim
        const DecoratedBox(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
              colors: [AppColors.scrimTransparent, AppColors.scrimGradient],
              stops: [0.4, 1.0],
            ),
          ),
        ),

        // Back + share buttons + centered "Check-In" title
        Positioned(
          top: 0,
          left: 0,
          right: 0,
          child: SafeArea(
            bottom: false,
            child: Padding(
              padding: const EdgeInsets.symmetric(
                horizontal: AppSpacing.x5,
                vertical: AppSpacing.x2,
              ),
              child: Row(
                children: [
                  _HeroBtn(
                    icon: Icons.arrow_back_ios_new_rounded,
                    label: 'Back',
                    onTap: () => Navigator.of(context).maybePop(),
                  ),
                  Expanded(
                    child: Center(
                      child: Text(
                        'Check-In',
                        style: AppTypography.titleSheet(
                          context,
                        ).copyWith(color: AppColors.textOnPrimary),
                      ),
                    ),
                  ),
                  _HeroBtn(
                    icon: Icons.ios_share_rounded,
                    label: 'Share',
                    onTap: () => ShareHelper.shareActivity(activity),
                  ),
                ],
              ),
            ),
          ),
        ),

        // Sport + distance badges — bottom
        Positioned(
          left: AppSpacing.x5,
          bottom: AppSpacing.x4 + 40,
          child: Row(
            children: [
              // Sport — white pill
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 12,
                  vertical: 6,
                ),
                decoration: BoxDecoration(
                  color: AppColors.textOnPrimary,
                  borderRadius: BorderRadius.circular(AppRadius.pill),
                ),
                child: Text(
                  activity.sportType.toUpperCase(),
                  style: AppTypography.chipLabel(
                    context,
                  ).copyWith(color: AppColors.textPrimary, fontSize: 11),
                ),
              ),
              // Distance — green pill (hidden when unknown).
              if (distanceLabel(activity.distanceKm)
                  case final distanceText?) ...[
                const SizedBox(width: AppSpacing.x2),
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 10,
                    vertical: 6,
                  ),
                  decoration: BoxDecoration(
                    color: AppColors.success,
                    borderRadius: BorderRadius.circular(AppRadius.pill),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(
                        Icons.location_on_rounded,
                        size: 12,
                        color: AppColors.textOnPrimary,
                      ),
                      const SizedBox(width: 4),
                      Text(
                        distanceText.toUpperCase(),
                        style: AppTypography.chipLabel(context).copyWith(
                          color: AppColors.textOnPrimary,
                          fontSize: 11,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ],
          ),
        ),
      ],
    );
  }

  Widget _placeholder() => Container(
    decoration: const BoxDecoration(
      gradient: LinearGradient(
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
        colors: [AppColors.primary, AppColors.primaryDark],
      ),
    ),
    child: Center(
      child: Icon(
        Icons.sports,
        size: 64,
        color: AppColors.textOnPrimary.withValues(alpha: 0.38),
      ),
    ),
  );
}

class _HeroBtn extends StatelessWidget {
  const _HeroBtn({
    required this.icon,
    required this.label,
    required this.onTap,
  });
  final IconData icon;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: label,
      child: PressableScale(
        onTap: onTap,
        child: SizedBox(
          width: 44,
          height: 44,
          child: Center(
            child: Container(
              width: 36,
              height: 36,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: AppColors.scrimControl,
                borderRadius: BorderRadius.circular(AppRadius.md),
              ),
              child: Icon(icon, size: 18, color: AppColors.textOnPrimary),
            ),
          ),
        ),
      ),
    );
  }
}

// Details card.

class _DetailsCard extends StatelessWidget {
  const _DetailsCard({required this.activity});
  final ActivityModel activity;

  @override
  Widget build(BuildContext context) {
    final dateStr = DateFormat('EEE, MMM d').format(activity.dateTime);
    final startStr = DateFormat('h:mm a').format(activity.dateTime);
    final endStr = DateFormat('h:mm a').format(activity.endTime);
    final address =
        activity.addressLine ?? distanceLabel(activity.distanceKm) ?? '';

    return Container(
      decoration: BoxDecoration(
        color: context.colors.surface,
        borderRadius: BorderRadius.circular(AppRadius.card),
        border: Border.all(color: context.colors.border),
        boxShadow: AppShadows.card,
      ),
      child: Column(
        children: [
          _DetailRow(
            iconBg: context.colors.primarySoft,
            icon: Icons.bolt_rounded,
            iconColor: context.colors.primaryOnSurface,
            title: '${activity.skillLevel.toUpperCase()} LEVEL',
            subtitle: activity.description.isNotEmpty
                ? activity.description.split('.').first
                : 'Join us for a great game',
          ),
          Divider(height: 1, color: context.colors.border, indent: 60),
          _DetailRow(
            iconBg: context.colors.primarySoft,
            icon: Icons.access_time_rounded,
            iconColor: context.colors.primaryOnSurface,
            title: '$dateStr · $startStr – $endStr',
            subtitle: 'Arrive 10m early to warm up',
          ),
          Divider(height: 1, color: context.colors.border, indent: 60),
          _DetailRow(
            iconBg: context.colors.primarySoft,
            icon: Icons.place_outlined,
            iconColor: context.colors.primaryOnSurface,
            title: activity.location,
            subtitle: address,
          ),
          Divider(height: 1, color: context.colors.border, indent: 60),
          _DetailRow(
            iconBg: context.colors.primarySoft,
            icon: Icons.attach_money_rounded,
            iconColor: context.colors.primaryOnSurface,
            title: !activity.isPaid
                ? 'Free Activity'
                : activity.isSplitCost
                ? 'Split Cost'
                : 'Paid Activity',
            subtitle: !activity.isPaid
                ? 'No cost to join'
                : activity.splitExplainer ??
                      activity.feeLabel ??
                      'Fee required to join',
            trailingChip: _FeeChip(isPaid: activity.isPaid),
          ),
        ],
      ),
    );
  }
}

class _DetailRow extends StatelessWidget {
  const _DetailRow({
    required this.iconBg,
    required this.icon,
    required this.iconColor,
    required this.title,
    required this.subtitle,
    this.trailingChip,
  });
  final Color iconBg;
  final IconData icon;
  final Color iconColor;
  final String title;
  final String subtitle;
  final Widget? trailingChip;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.x4,
        vertical: AppSpacing.x3,
      ),
      child: Row(
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(color: iconBg, shape: BoxShape.circle),
            alignment: Alignment.center,
            child: Icon(icon, size: 18, color: iconColor),
          ),
          const SizedBox(width: AppSpacing.x3),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: AppTypography.labelField(context),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 2),
                Text(
                  subtitle,
                  style: AppTypography.metaSub(context),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),
          if (trailingChip != null) ...[
            const SizedBox(width: AppSpacing.x2),
            trailingChip!,
          ],
        ],
      ),
    );
  }
}

class _FeeChip extends StatelessWidget {
  const _FeeChip({required this.isPaid});
  final bool isPaid;

  @override
  Widget build(BuildContext context) {
    final bgColor = isPaid
        ? context.colors.warningBg
        : context.colors.statusSuccessBg;
    final fgColor = isPaid
        ? context.colors.warningText
        : context.colors.successText;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: BorderRadius.circular(AppRadius.pill),
      ),
      child: Text(
        isPaid ? 'Paid' : 'Free',
        style: AppTypography.chipLabel(
          context,
        ).copyWith(color: fgColor, fontWeight: FontWeight.w700, fontSize: 12),
      ),
    );
  }
}

// Status panel.

class _StatusPanel extends StatelessWidget {
  const _StatusPanel({required this.status, required this.gate});
  final _CheckInStatus status;
  final _Gate gate;

  @override
  Widget build(BuildContext context) {
    /// Accent resolution per (status, theme): all semantic accents come from theme-aware tokens (successText.
    final (
      Color bg,
      Color accent,
      IconData icon,
      String title,
      String body,
    ) = switch (status) {
      _CheckInStatus.notCheckedIn => (
        context.colors.warningBg,
        context.colors.warningText,
        gate.icon,
        gate.title,
        gate.body,
      ),
      _CheckInStatus.locating => (
        context.colors.primarySoft,
        context.colors.primaryOnSurface,
        Icons.my_location_rounded,
        'Locating…',
        'We are verifying that you are at the activity venue.',
      ),
      _CheckInStatus.checkedIn => (
        context.colors.statusSuccessBg,
        context.colors.successText,
        Icons.check_circle_rounded,
        'Checked in!',
        'Your attendance has been confirmed. Enjoy the game!',
      ),
      _CheckInStatus.locationDenied => (
        context.colors.warningBg,
        context.colors.warningText,
        Icons.location_off_rounded,
        'Location permission needed',
        'Enable location access so we can verify your attendance.',
      ),
    };

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(AppSpacing.x4),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(AppRadius.card),
        border: Border.all(color: accent.withValues(alpha: 0.25)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, color: accent, size: 22),
          const SizedBox(width: AppSpacing.x3),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: AppTypography.labelField(
                    context,
                  ).copyWith(color: accent, fontWeight: FontWeight.w700),
                ),
                const SizedBox(height: 4),
                Text(
                  body,
                  style: AppTypography.metaSub(
                    context,
                  ).copyWith(color: accent, fontSize: 13, height: 1.4),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// Check In button.

class _CheckInButton extends StatelessWidget {
  const _CheckInButton({
    required this.status,
    required this.enabled,
    required this.onCheckIn,
  });
  final _CheckInStatus status;
  final bool enabled;
  final Future<void> Function() onCheckIn;

  @override
  Widget build(BuildContext context) {
    final isLocating = status == _CheckInStatus.locating;
    final isDone = status == _CheckInStatus.checkedIn;
    final tappable = enabled && !isLocating && !isDone;

    return PressableScale(
      onTap: tappable ? onCheckIn : null,
      child: Opacity(
        opacity: tappable || isDone ? 1 : 0.45,
        child: Container(
          width: double.infinity,
          height: 56,
          decoration: BoxDecoration(
            color: isDone ? AppColors.statusSuccessText : AppColors.primary,
            borderRadius: BorderRadius.circular(AppRadius.pill),
            boxShadow: isDone ? null : AppShadows.glowPrimary,
          ),
          alignment: Alignment.center,
          child: isLocating
              ? const SizedBox(
                  width: 22,
                  height: 22,
                  child: CircularProgressIndicator(
                    strokeWidth: 2.5,
                    valueColor: AlwaysStoppedAnimation(AppColors.textOnPrimary),
                  ),
                )
              : Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(
                      isDone
                          ? Icons.check_circle_outline_rounded
                          : Icons.location_on_rounded,
                      size: 20,
                      color: AppColors.textOnPrimary,
                    ),
                    const SizedBox(width: AppSpacing.x2),
                    Text(
                      isDone ? 'Checked In' : 'Check In',
                      style: AppTypography.buttonPrimary,
                    ),
                  ],
                ),
        ),
      ),
    );
  }
}
