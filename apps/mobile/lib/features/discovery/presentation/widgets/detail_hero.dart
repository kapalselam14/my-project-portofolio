part of '../activity_detail_screen.dart';

class _Hero extends StatelessWidget {
  const _Hero({required this.activity});
  final ActivityModel activity;

  static const double heroHeight = 280;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: heroHeight,
      child: Stack(
        fit: StackFit.expand,
        children: [
          // Cover image (bundled asset or remote Storage URL)
          activity.coverImageUrl != null
              ? AssetImageWithFallback(
                  imagePath: activity.coverImageUrl!,
                  fit: BoxFit.cover,
                )
              : _placeholder(),

          // Subtle gradient scrim — darkens from bottom so badges stay legible
          const DecoratedBox(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: [AppColors.scrimTransparent, AppColors.scrimGradient],
                stops: [0.45, 1.0],
              ),
            ),
          ),

          // Back + Share buttons pinned to top
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
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    _HeroBtn(
                      icon: AppIcons.arrowLeft,
                      onTap: () => _popOrDiscovery(context),
                      label: 'Back',
                    ),
                    _HeroBtn(
                      icon: AppIcons.share,
                      onTap: () => ShareHelper.shareActivity(activity),
                      label: 'Share',
                    ),
                  ],
                ),
              ),
            ),
          ),

          // Pills — bottom, always above the card (last in Stack z-order).
          Positioned(
            left: AppSpacing.x5,
            bottom: AppSpacing.x4 + 20 + 20,
            child: Wrap(
              spacing: AppSpacing.x2,
              runSpacing: AppSpacing.x2,
              children: [
                _SportBadgeHero(sport: activity.sportType),
                _SkillBadgeHero(level: activity.skillLevel),
              ],
            ),
          ),
        ],
      ),
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
    required this.onTap,
    required this.label,
  });
  final String icon;
  final VoidCallback onTap;
  final String label;

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
                color: context.colors.scrimControl,
                borderRadius: BorderRadius.circular(AppRadius.md),
              ),
              child: AppIcon(
                icon,
                size: AppIconSize.lg,
                color: AppColors.textOnPrimary,
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// White pill badge for sport type — shown over hero image.

/// White pill badge for sport type — shown over hero image.
class _SportBadgeHero extends StatelessWidget {
  const _SportBadgeHero({required this.sport});
  final String sport;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: AppColors.textOnPrimary,
        borderRadius: BorderRadius.circular(AppRadius.pill),
      ),
      child: Text(
        sport.toUpperCase(),
        style: AppTypography.chipLabel(
          context,
        ).copyWith(color: AppColors.textPrimary),
      ),
    );
  }
}

/// Blue filled pill badge for skill level — shown over hero image.

/// Blue filled pill badge for skill level — shown over hero image.
class _SkillBadgeHero extends StatelessWidget {
  const _SkillBadgeHero({required this.level});
  final String level;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: AppColors.primary,
        borderRadius: BorderRadius.circular(AppRadius.pill),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(
            Icons.flash_on_rounded,
            size: 13,
            color: AppColors.textOnPrimary,
          ),
          const SizedBox(width: 4),
          Text(
            level.toUpperCase(),
            style: AppTypography.chipLabel(
              context,
            ).copyWith(color: AppColors.textOnPrimary),
          ),
        ],
      ),
    );
  }
}

// Host card.
