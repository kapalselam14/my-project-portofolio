import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/providers/profile_providers.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/theme/dark_colors.dart';
import '../../../core/utils/nav_guard.dart';
import '../../../core/utils/share_helper.dart';
import '../../../core/widgets/app_button.dart';
import '../../../core/widgets/app_icon.dart';
import '../../../core/widgets/app_scaffold.dart';
import '../../../core/widgets/asset_image.dart';
import '../../../core/widgets/error_retry.dart';
import '../../../core/widgets/pressable_scale.dart';
import '../../../core/widgets/skeleton.dart';
import '../../report/presentation/report_user_sheet.dart';
import '../domain/user_model.dart';

// Screen.

class PlayerProfileScreen extends ConsumerWidget {
  /// Opens by display name (legacy callers: activity screens).
  const PlayerProfileScreen({super.key, required this.playerName})
    : userId = null;

  /// Opens by auth uid — exact, URL-safe, and unambiguous.
  const PlayerProfileScreen.byUid({super.key, required this.userId})
    : playerName = '';

  /// Display-name lookup key (legacy route `/player-profile/:name`).
  final String playerName;

  /// Auth-uid lookup key (route `/player-profile/uid/:uid`).
  final String? userId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final lookupKey = (userId != null && userId!.isNotEmpty)
        ? userId!
        : playerName;
    // Name-based lookup has no backend support (no name-search endpoint.
    final isNameLookup = userId == null || userId!.isEmpty;
    final playerAsync = isNameLookup
        ? null
        : ref.watch(playerProfileProvider(lookupKey));

    return AppScaffold(
      showHomeIndicator: false, // inside ShellRoute — AppShell draws its own.
      body: isNameLookup
          ? _UnavailableProfile(onBack: () => context.pop())
          : playerAsync!.when(
              loading: () => const SkeletonList(count: 6),
              error: (_, _) => ErrorRetry(
                message: 'Could not load profile.',
                onRetry: () => ref.invalidate(playerProfileProvider(lookupKey)),
              ),
              data: (user) {
                if (user == null) {
                  return Center(
                    child: Text(
                      'Player not found.',
                      style: AppTypography.bodyReading(
                        context,
                      ).copyWith(color: context.colors.textSecondary),
                    ),
                  );
                }
                return _ProfileContent(user: user);
              },
            ),
    );
  }
}

/// Empty state for the legacy name-based route: the profile can't be resolved without a uid.
class _UnavailableProfile extends StatelessWidget {
  const _UnavailableProfile({required this.onBack});
  final VoidCallback onBack;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.x6),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              Icons.person_off_outlined,
              size: 48,
              color: context.colors.textTertiary,
            ),
            const SizedBox(height: AppSpacing.x4),
            Text(
              'Profile not available',
              style: AppTypography.titleMedium(context),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: AppSpacing.x2),
            Text(
              'Open this profile from the roster to see details.',
              style: AppTypography.bodyMedium(
                context,
              ).copyWith(color: context.colors.textSecondary),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: AppSpacing.x5),
            AppButton(label: 'Back', onPressed: onBack),
          ],
        ),
      ),
    );
  }
}

// Content.

class _ProfileContent extends StatelessWidget {
  const _ProfileContent({required this.user});
  final UserModel user;

  static const double _avatarSize = 110;
  static const double _avatarRingWidth = 3;
  static const double _avatarRingGap = 4;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Expanded(
          child: SingleChildScrollView(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Top bar: back more.
                Padding(
                  padding: const EdgeInsets.symmetric(
                    horizontal: AppSpacing.x4,
                    vertical: AppSpacing.x1,
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      _CircleBtn(
                        icon: Icons.arrow_back_ios_new_rounded,
                        onTap: () => context.pop(),
                        label: 'Back',
                      ),
                      _CircleBtn(
                        icon: Icons.more_horiz_rounded,
                        onTap: () =>
                            _ProfileOptionsSheet.show(context, user: user),
                        label: 'More options',
                      ),
                    ],
                  ),
                ),

                // Avatar.
                Center(
                  child: Container(
                    width:
                        _avatarSize + 2 * (_avatarRingWidth + _avatarRingGap),
                    height:
                        _avatarSize + 2 * (_avatarRingWidth + _avatarRingGap),
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      border: Border.all(
                        color: context.colors.primaryOnSurface,
                        width: _avatarRingWidth,
                      ),
                    ),
                    padding: const EdgeInsets.all(_avatarRingGap),
                    child: Container(
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: context.colors.primaryLight,
                      ),
                      clipBehavior: Clip.antiAlias,
                      child: (user.avatarUrl ?? user.avatarAsset) != null
                          ? AssetImageWithFallback(
                              imagePath: user.avatarUrl ?? user.avatarAsset!,
                              fit: BoxFit.cover,
                            )
                          : _AvatarFallback(name: user.displayName),
                    ),
                  ),
                ),
                const SizedBox(height: AppSpacing.x4),

                // Name.
                Padding(
                  padding: const EdgeInsets.symmetric(
                    horizontal: AppSpacing.x6,
                  ),
                  child: SizedBox(
                    width: double.infinity,
                    child: Text(
                      user.displayName.toUpperCase(),
                      textAlign: TextAlign.center,
                      style: AppTypography.titleScreen(
                        context,
                      ).copyWith(fontSize: 24, letterSpacing: 0.5),
                    ),
                  ),
                ),

                // Location.
                if (user.location != null) ...[
                  const SizedBox(height: AppSpacing.x1),
                  Center(
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        AppIcon(
                          AppIcons.mapPin,
                          size: AppIconSize.sm,
                          color: context.colors.textSecondary,
                        ),
                        const SizedBox(width: 4),
                        Text(
                          user.location!,
                          style: AppTypography.metaSub(context),
                        ),
                      ],
                    ),
                  ),
                ],
                const SizedBox(height: AppSpacing.x5),

                // Physical chips (age height, when shared).
                // Age derives from dateOfBirth — the raw birthdate is never shown.
                if (user.age != null || user.heightCm != null) ...[
                  Center(
                    child: Wrap(
                      alignment: WrapAlignment.center,
                      spacing: AppSpacing.x2,
                      runSpacing: AppSpacing.x2,
                      children: [
                        if (user.age != null)
                          _InfoChip(
                            icon: Icons.cake_outlined,
                            label: '${user.age} yrs',
                          ),
                        if (user.heightCm != null)
                          _InfoChip(
                            icon: Icons.straighten_outlined,
                            label: '${user.heightCm} cm',
                          ),
                      ],
                    ),
                  ),
                  const SizedBox(height: AppSpacing.x5),
                ],

                // Stat cards.
                Padding(
                  padding: const EdgeInsets.symmetric(
                    horizontal: AppSpacing.x6,
                  ),
                  child: Row(
                    children: [
                      Expanded(
                        child: _StatCard(
                          valueWidget: Text(
                            '${user.activitiesCount}',
                            style: _StatCard.valueStyle(context),
                          ),
                          label: 'Activities',
                        ),
                      ),
                      const SizedBox(width: AppSpacing.x3),
                      Expanded(
                        child: _StatCard(
                          valueWidget: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              AppIcon(
                                AppIcons.star,
                                size: AppIconSize.sm,
                                color: context.colors.warningText,
                              ),
                              const SizedBox(width: 4),
                              Text(
                                (user.rating ?? 0) > 0
                                    ? user.rating!.toStringAsFixed(1)
                                    : '—',
                                style: _StatCard.valueStyle(context),
                              ),
                            ],
                          ),
                          label: 'Rating',
                        ),
                      ),
                      const SizedBox(width: AppSpacing.x3),
                      Expanded(
                        child: _StatCard(
                          valueWidget: Text(
                            '${user.hostedCount}',
                            style: _StatCard.valueStyle(context),
                          ),
                          label: 'Hosted',
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: AppSpacing.x5),

                // Host rating.
                // Stars received while hosting (separate from the player rating above).
                if (user.overallHostRating != null) ...[
                  Padding(
                    padding: const EdgeInsets.symmetric(
                      horizontal: AppSpacing.x6,
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Host rating',
                          style: AppTypography.titleMedium(context),
                        ),
                        const SizedBox(height: AppSpacing.x3),
                        Container(
                          width: double.infinity,
                          padding: const EdgeInsets.symmetric(
                            horizontal: AppSpacing.x4,
                            vertical: AppSpacing.x2,
                          ),
                          decoration: BoxDecoration(
                            color: context.colors.card,
                            borderRadius: AppRadius.cardR,
                            border: Border.all(color: context.colors.border),
                          ),
                          child: Column(
                            children: [
                              for (final entry
                                  in user.hostRatingBySport.entries)
                                _RatingRow(
                                  sport: entry.key,
                                  average: entry.value.average,
                                  count: entry.value.count,
                                ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: AppSpacing.x5),
                ],

                // Ratings by sport.
                if (user.ratingBySport.isNotEmpty) ...[
                  Padding(
                    padding: const EdgeInsets.symmetric(
                      horizontal: AppSpacing.x6,
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Ratings',
                          style: AppTypography.titleMedium(context),
                        ),
                        const SizedBox(height: AppSpacing.x3),
                        Container(
                          width: double.infinity,
                          padding: const EdgeInsets.symmetric(
                            horizontal: AppSpacing.x4,
                            vertical: AppSpacing.x2,
                          ),
                          decoration: BoxDecoration(
                            color: context.colors.card,
                            borderRadius: AppRadius.cardR,
                            border: Border.all(color: context.colors.border),
                          ),
                          child: Column(
                            children: [
                              for (final entry in user.ratingBySport.entries)
                                _RatingRow(
                                  sport: entry.key,
                                  average: entry.value.average,
                                  count: entry.value.count,
                                ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: AppSpacing.x5),
                ],

                // Bio.
                if (user.bio != null && user.bio!.isNotEmpty) ...[
                  Padding(
                    padding: const EdgeInsets.symmetric(
                      horizontal: AppSpacing.x6,
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('Bio', style: AppTypography.titleMedium(context)),
                        const SizedBox(height: AppSpacing.x3),
                        Container(
                          width: double.infinity,
                          padding: const EdgeInsets.all(AppSpacing.x4),
                          decoration: BoxDecoration(
                            color: context.colors.card,
                            borderRadius: AppRadius.cardR,
                            border: Border.all(color: context.colors.border),
                          ),
                          child: Text(
                            user.bio!,
                            style: AppTypography.bodyReading(
                              context,
                            ).copyWith(color: context.colors.textSecondary),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: AppSpacing.x5),
                ],

                // Sports.
                if (user.sports.isNotEmpty) ...[
                  Padding(
                    padding: const EdgeInsets.symmetric(
                      horizontal: AppSpacing.x6,
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'My Sports',
                          style: AppTypography.titleMedium(context),
                        ),
                        const SizedBox(height: AppSpacing.x3),
                        Wrap(
                          spacing: AppSpacing.x2,
                          runSpacing: AppSpacing.x2,
                          children: [
                            for (var i = 0; i < user.sports.length; i++)
                              _SportChip(
                                sport: user.sports[i].sport,
                                // Per-sport levels aren't persisted yet — fall back to the general skill level.
                                level: user.sports[i].level.isNotEmpty
                                    ? user.sports[i].level
                                    : (user.skillLevel ?? ''),
                                isPrimary: i == 0,
                              ),
                          ],
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: AppSpacing.x6),
                ],

                // Action buttons.
                Padding(
                  padding: const EdgeInsets.symmetric(
                    horizontal: AppSpacing.x6,
                  ),
                  child: Column(
                    children: [
                      AppButton(
                        label: 'Send Message',
                        leading: const Icon(
                          Icons.chat_bubble_outline_rounded,
                          size: 18,
                          color: AppColors.textOnPrimary,
                        ),
                        onPressed: () => NavGuard.push(
                          context,
                          '/dm/${user.id}',
                          extra: user.displayName,
                        ),
                      ),
                      const SizedBox(height: AppSpacing.x3),
                      AppButton.secondary(
                        label: 'Report Profile',
                        leading: Icon(
                          Icons.flag_outlined,
                          size: 18,
                          color: context.colors.textPrimary,
                        ),
                        onPressed: () => ReportUserSheet.show(
                          context,
                          userId: user.id,
                          userName: user.displayName,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: AppSpacing.x8),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

// Sub widgets.

class _CircleBtn extends StatelessWidget {
  const _CircleBtn({
    required this.icon,
    required this.onTap,
    required this.label,
  });
  final IconData icon;
  final VoidCallback onTap;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: label,
      child: PressableScale(
        onTap: () {
          HapticFeedback.lightImpact();
          onTap();
        },
        child: SizedBox(
          width: 44,
          height: 44,
          child: Center(
            child: Container(
              width: 36,
              height: 36,
              decoration: BoxDecoration(
                color: context.colors.surface,
                shape: BoxShape.circle,
                border: Border.all(color: context.colors.border),
                boxShadow: AppShadows.card,
              ),
              alignment: Alignment.center,
              child: Icon(icon, size: 18, color: context.colors.textPrimary),
            ),
          ),
        ),
      ),
    );
  }
}

class _AvatarFallback extends StatelessWidget {
  const _AvatarFallback({required this.name});
  final String name;

  @override
  Widget build(BuildContext context) {
    return Container(
      color: context.colors.primaryLight,
      alignment: Alignment.center,
      child: Text(
        name.isNotEmpty ? name[0].toUpperCase() : '?',
        style: AppTypography.titleScreen(
          context,
        ).copyWith(color: context.colors.primaryOnSurface, fontSize: 32),
      ),
    );
  }
}

class _StatCard extends StatelessWidget {
  const _StatCard({required this.valueWidget, required this.label});
  final Widget valueWidget;
  final String label;

  static TextStyle valueStyle(BuildContext context) =>
      AppTypography.titleScreen(
        context,
      ).copyWith(fontSize: 18, color: context.colors.textPrimary);

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(
        vertical: AppSpacing.x3,
        horizontal: AppSpacing.x2,
      ),
      decoration: BoxDecoration(
        color: context.colors.card,
        borderRadius: AppRadius.cardR,
        border: Border.all(color: context.colors.border),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          valueWidget,
          const SizedBox(height: 4),
          Text(
            label.toUpperCase(),
            textAlign: TextAlign.center,
            style: AppTypography.metaSub(context).copyWith(
              fontWeight: FontWeight.w600,
              letterSpacing: 0.5,
              fontSize: 10,
            ),
          ),
        ],
      ),
    );
  }
}

/// Small icon + label pill for the physical chips (age, height).
class _InfoChip extends StatelessWidget {
  const _InfoChip({required this.icon, required this.label});
  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
      decoration: BoxDecoration(
        color: context.colors.surfaceMuted,
        borderRadius: BorderRadius.circular(AppRadius.pill),
        border: Border.all(color: context.colors.border),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 14, color: context.colors.textSecondary),
          const SizedBox(width: 6),
          Text(
            label,
            style: AppTypography.metaSub(context).copyWith(
              fontWeight: FontWeight.w600,
              color: context.colors.textPrimary,
            ),
          ),
        ],
      ),
    );
  }
}

class _SportChip extends StatelessWidget {
  const _SportChip({
    required this.sport,
    required this.level,
    required this.isPrimary,
  });
  final String sport;
  final String level;
  final bool isPrimary;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(14, 10, 14, 10),
      decoration: BoxDecoration(
        color: context.colors.surface,
        borderRadius: BorderRadius.circular(AppRadius.pill),
        border: Border.all(color: context.colors.border),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            sport,
            style: AppTypography.labelField(
              context,
            ).copyWith(color: context.colors.textPrimary),
          ),
          // No badge when neither per-sport nor general level is known — an empty pill reads as broken UI.
          if (level.isNotEmpty) ...[
            const SizedBox(width: AppSpacing.x2),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
              decoration: BoxDecoration(
                color: isPrimary
                    ? context.colors.primarySoft
                    : context.colors.surfaceMuted,
                borderRadius: BorderRadius.circular(AppRadius.pill),
              ),
              child: Text(
                level.toUpperCase(),
                style: AppTypography.chipLabel(context).copyWith(
                  color: isPrimary
                      ? context.colors.primaryOnSurface
                      : context.colors.textSecondary,
                  fontSize: 10,
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

/// One row of the per-sport rating breakdown: sport name on the left, "★ 4.8 (12)" on the right.
class _RatingRow extends StatelessWidget {
  const _RatingRow({
    required this.sport,
    required this.average,
    required this.count,
  });
  final String sport;
  final double average;
  final int count;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: AppSpacing.x2),
      child: Row(
        children: [
          Expanded(
            child: Text(
              sport,
              style: AppTypography.labelField(context),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ),
          AppIcon(
            AppIcons.star,
            size: AppIconSize.sm,
            color: context.colors.warningText,
          ),
          const SizedBox(width: 4),
          Text(
            '${average.toStringAsFixed(1)} ($count)',
            style: AppTypography.labelField(
              context,
            ).copyWith(color: context.colors.textSecondary),
          ),
        ],
      ),
    );
  }
}

// More options sheet.

/// Bottom sheet behind the header ⋯ button: share the profile or report it (same.
class _ProfileOptionsSheet extends StatelessWidget {
  const _ProfileOptionsSheet({required this.user});
  final UserModel user;

  static Future<void> show(BuildContext context, {required UserModel user}) {
    return showModalBottomSheet<void>(
      context: context,
      useSafeArea: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _ProfileOptionsSheet(user: user),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.fromLTRB(
        AppSpacing.x5,
        AppSpacing.x3,
        AppSpacing.x5,
        AppSpacing.x5 + MediaQuery.of(context).viewPadding.bottom,
      ),
      decoration: BoxDecoration(
        color: context.colors.surface,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 36,
            height: 4,
            decoration: BoxDecoration(
              color: context.colors.border,
              borderRadius: BorderRadius.circular(2),
            ),
          ),
          const SizedBox(height: AppSpacing.x4),
          _OptionsRow(
            icon: Icons.ios_share_rounded,
            label: 'Share profile',
            onTap: () {
              Navigator.of(context).pop();
              ShareHelper.shareProfile(user);
            },
          ),
          _OptionsRow(
            icon: Icons.flag_outlined,
            label: 'Report profile',
            onTap: () {
              Navigator.of(context).pop();
              ReportUserSheet.show(
                context,
                userId: user.id,
                userName: user.displayName,
              );
            },
          ),
        ],
      ),
    );
  }
}

class _OptionsRow extends StatelessWidget {
  const _OptionsRow({
    required this.icon,
    required this.label,
    required this.onTap,
  });
  final IconData icon;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return PressableScale(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: AppSpacing.x3),
        child: Row(
          children: [
            Icon(icon, size: 20, color: context.colors.textPrimary),
            const SizedBox(width: AppSpacing.x4),
            Text(label, style: AppTypography.titleMedium(context)),
          ],
        ),
      ),
    );
  }
}
