part of '../joined_activity_detail_screen.dart';

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
              stops: [0.45, 1.0],
            ),
          ),
        ),

        // Back button — top-left
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
                    icon: Icons.arrow_back_ios_new_rounded,
                    onTap: () => Navigator.of(context).maybePop(),
                    label: 'Back',
                  ),
                  _HeroBtn(
                    icon: Icons.ios_share_rounded,
                    onTap: () => ShareHelper.shareActivity(activity),
                    label: 'Share',
                  ),
                ],
              ),
            ),
          ),
        ),

        // Sport + JOINED badges — bottom-left (CANCELLED when cancelled)
        Positioned(
          left: AppSpacing.x5,
          bottom: AppSpacing.x4 + 40,
          child: Row(
            children: [
              _PillBadge(
                label: activity.sportType.toUpperCase(),
                bgColor: AppColors.textOnPrimary,
                textColor: AppColors.textPrimary,
              ),
              const SizedBox(width: AppSpacing.x2),
              if (activity.lifecycleStatus.toLowerCase() == 'cancelled')
                _PillBadge(
                  label: 'CANCELLED',
                  bgColor: context.colors.errorLight,
                  textColor: context.colors.errorText,
                )
              else
                _PillBadge(
                  label: '✓  JOINED',
                  bgColor: AppColors.avatarSecondary,
                  textColor: AppColors.textOnPrimary,
                ),
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

class _PillBadge extends StatelessWidget {
  const _PillBadge({
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
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: BorderRadius.circular(AppRadius.pill),
      ),
      child: Text(
        label,
        style: AppTypography.chipLabel(
          context,
        ).copyWith(color: textColor, fontSize: 11),
      ),
    );
  }
}

// Joined banner.
