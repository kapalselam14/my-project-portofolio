import 'package:flutter/material.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../core/theme/app_typography.dart';
import '../../../../core/theme/dark_colors.dart';
import '../../../../core/widgets/app_tappable.dart';
import '../../../../core/widgets/empty_state.dart';

/// Empty state shown once the swipe deck runs out of activities.
/// When [filterSummary] is non-empty the deck is empty *because of* the active filter.
class DiscoveryEmptyDeck extends StatelessWidget {
  const DiscoveryEmptyDeck({
    super.key,
    required this.onRestart,
    this.filterSummary,
    this.onClearFilters,
    this.onShowUnseen,
  });

  final VoidCallback onRestart;

  /// Human-readable active filter.
  final String? filterSummary;
  final VoidCallback? onClearFilters;

  /// Start-over latch release: when non-null (the deck is showing swiped cards via "Start over"), a second "Unseen.
  final VoidCallback? onShowUnseen;

  @override
  Widget build(BuildContext context) {
    final filtered = (filterSummary ?? '').isNotEmpty;
    // Max + centered: the parent Padding fills the Expanded deck area.
    return Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        EmptyState(
          icon: Icons.travel_explore_rounded,
          title: filtered
              ? 'No matches for these filters'
              : "You're all caught up",
          subtitle: filtered
              ? 'Nothing within $filterSummary. Loosen the filters or check back later.'
              : "You've seen all activities near you. Check back later or "
                    'adjust your preferences to see more.',
          actionLabel: 'Start over',
          onAction: onRestart,
        ),
        if (filtered && onClearFilters != null) ...[
          const SizedBox(height: AppSpacing.x3),
          AppTappable(
            semanticLabel: 'Clear filters',
            onTap: onClearFilters!,
            feedback: AppTapFeedback.scale,
            minSize: 0,
            child: Padding(
              padding: const EdgeInsets.symmetric(
                horizontal: AppSpacing.x4,
                vertical: AppSpacing.x2,
              ),
              child: Text(
                'Clear filters',
                style: AppTypography.labelField(context).copyWith(
                  color: context.colors.primaryOnSurface,
                  decoration: TextDecoration.underline,
                ),
              ),
            ),
          ),
        ],
        if (onShowUnseen != null) ...[
          const SizedBox(height: AppSpacing.x2),
          AppTappable(
            semanticLabel: 'Unseen only',
            onTap: onShowUnseen!,
            feedback: AppTapFeedback.scale,
            minSize: 0,
            child: Padding(
              padding: const EdgeInsets.symmetric(
                horizontal: AppSpacing.x4,
                vertical: AppSpacing.x2,
              ),
              child: Text(
                'Unseen only',
                style: AppTypography.labelField(context).copyWith(
                  color: context.colors.primaryOnSurface,
                  decoration: TextDecoration.underline,
                ),
              ),
            ),
          ),
        ],
      ],
    );
  }
}

/// Which theme-aware foreground colour an unfilled [DiscoveryAction] uses.
enum _ActionTone { reject, info }

/// Tinder-style floating action below the swipe deck: a circular button with a caption beneath it.
class DiscoveryAction extends StatelessWidget {
  const DiscoveryAction._({
    required this.icon,
    required this.label,
    required this.onTap,
    required this.size,
    required this.filled,
    // `this._tone` would force the callsite parameter name to also be `_tone`.
    _ActionTone tone = _ActionTone.reject,
  }) : _tone = tone; // ignore: prefer_initializing_formals

  factory DiscoveryAction.reject({required VoidCallback onTap}) =>
      DiscoveryAction._(
        icon: Icons.close_rounded,
        label: 'Not now',
        onTap: onTap,
        size: 62,
        filled: false,
      );

  factory DiscoveryAction.info({required VoidCallback onTap}) =>
      DiscoveryAction._(
        icon: Icons.info_outline_rounded,
        label: 'Details',
        onTap: onTap,
        size: 54,
        filled: false,
        tone: _ActionTone.info,
      );

  factory DiscoveryAction.join({required VoidCallback onTap}) =>
      DiscoveryAction._(
        icon: Icons.sports_basketball_rounded,
        label: 'Join game',
        onTap: onTap,
        size: 68,
        filled: true,
      );

  /// Approval-gated variant: same weight, "Request" wording + send icon.
  factory DiscoveryAction.request({required VoidCallback onTap}) =>
      DiscoveryAction._(
        icon: Icons.send_rounded,
        label: 'Request',
        onTap: onTap,
        size: 68,
        filled: true,
      );

  final IconData icon;
  final String label;
  final VoidCallback onTap;
  final double size;
  final bool filled;
  final _ActionTone _tone;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final iconColor = filled
        ? AppColors.textOnPrimary
        : switch (_tone) {
            _ActionTone.info => c.primaryOnSurface,
            _ActionTone.reject => c.errorText,
          };
    return AppTappable(
      semanticLabel: label,
      feedback: AppTapFeedback.scale,
      minSize: size,
      borderRadius: size / 2,
      onTap: onTap,
      child: Container(
        width: size,
        height: size,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: filled ? null : c.surface,
          gradient: filled
              ? const LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [AppColors.primary, AppColors.primaryDark],
                )
              : null,
          border: filled ? null : Border.all(color: c.border),
          boxShadow: filled ? AppShadows.glowPrimary : AppShadows.card,
        ),
        alignment: Alignment.center,
        child: Icon(
          icon,
          size: filled ? 30 : (size >= 62 ? 26 : 22),
          color: iconColor,
        ),
      ),
    );
  }
}
