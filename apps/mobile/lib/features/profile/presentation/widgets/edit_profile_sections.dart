part of '../edit_profile_screen.dart';

/// Caption under fields the backend can't persist yet.
class _NotSyncedCaption extends StatelessWidget {
  const _NotSyncedCaption();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.x3,
        vertical: AppSpacing.x2,
      ),
      decoration: BoxDecoration(
        color: context.colors.primarySoft,
        borderRadius: BorderRadius.circular(AppRadius.md),
      ),
      child: Row(
        children: [
          Icon(
            Icons.info_outline_rounded,
            size: 14,
            color: context.colors.primaryOnSurface,
          ),
          const SizedBox(width: AppSpacing.x2),
          Expanded(
            child: Text(
              'Saved on this device only for now',
              style: AppTypography.metaSub(
                context,
              ).copyWith(color: context.colors.primaryOnSurface),
            ),
          ),
        ],
      ),
    );
  }
}

class _SectionCard extends StatelessWidget {
  const _SectionCard({
    required this.title,
    required this.child,
    required this.icon,
    this.trailing,
  });
  final String title;
  final Widget child;
  final IconData icon;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(AppSpacing.x4),
      decoration: BoxDecoration(
        color: context.colors.surface,
        borderRadius: BorderRadius.circular(AppRadius.lg),
        border: Border.all(color: context.colors.border),
        boxShadow: AppShadows.card,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 32,
                height: 32,
                decoration: BoxDecoration(
                  color: context.colors.primarySoft,
                  borderRadius: BorderRadius.circular(AppRadius.md),
                ),
                alignment: Alignment.center,
                child: Icon(
                  icon,
                  size: 17,
                  color: context.colors.primaryOnSurface,
                ),
              ),
              const SizedBox(width: AppSpacing.x3),
              Expanded(
                child: Text(title, style: AppTypography.titleMedium(context)),
              ),
              ?trailing,
            ],
          ),
          const SizedBox(height: AppSpacing.x4),
          child,
        ],
      ),
    );
  }
}

// Avatar block.

class _AvatarBlock extends StatelessWidget {
  const _AvatarBlock({
    required this.user,
    required this.isUploading,
    required this.onTap,
  });
  final UserModel user;
  final bool isUploading;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final photo = user.avatarUrl ?? user.avatarAsset;

    return PressableScale(
      onTap: isUploading ? null : onTap,
      child: Column(
        children: [
          Stack(
            clipBehavior: Clip.none,
            alignment: Alignment.center,
            children: [
              // Soft halo behind the avatar.
              Container(
                width: 124,
                height: 124,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: context.colors.primarySoft,
                ),
              ),
              // Avatar with gradient ring.
              Container(
                width: 104,
                height: 104,
                decoration: const BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: LinearGradient(
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                    colors: [AppColors.primary, AppColors.primaryDark],
                  ),
                  boxShadow: AppShadows.glowPrimary,
                ),
                child: Padding(
                  padding: const EdgeInsets.all(3),
                  child: ClipOval(
                    child: photo != null
                        ? AssetImageWithFallback(
                            imagePath: photo,
                            fit: BoxFit.cover,
                            isAvatar: true,
                          )
                        : Container(
                            color: context.colors.surface,
                            child: Icon(
                              Icons.person,
                              size: 48,
                              color: context.colors.primaryOnSurface,
                            ),
                          ),
                  ),
                ),
              ),
              // Upload progress covers the avatar while uploading.
              if (isUploading)
                Positioned.fill(
                  child: Container(
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: context.colors.surface.withValues(alpha: 0.6),
                    ),
                    alignment: Alignment.center,
                    child: const SizedBox(
                      width: 28,
                      height: 28,
                      child: CircularProgressIndicator(strokeWidth: 3),
                    ),
                  ),
                ),
              // Camera badge
              Positioned(
                right: 6,
                bottom: 6,
                child: Container(
                  padding: const EdgeInsets.all(7),
                  decoration: BoxDecoration(
                    color: AppColors.primary,
                    shape: BoxShape.circle,
                    border: Border.all(
                      color: context.colors.surface,
                      width: 2.5,
                    ),
                    boxShadow: AppShadows.glowPrimary,
                  ),
                  child: const Icon(
                    Icons.camera_alt_rounded,
                    size: 14,
                    color: AppColors.textOnPrimary,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.x2),
          Text(
            isUploading ? 'Uploading…' : 'Change Photo',
            style: AppTypography.chipLabel(context).copyWith(
              color: context.colors.primaryOnSurface,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }
}

// Sport entry card.
