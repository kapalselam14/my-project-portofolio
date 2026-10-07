part of '../create_activity_screen.dart';

class _CoverPhoto extends StatelessWidget {
  const _CoverPhoto({
    required this.uploadInfo,
    required this.onTap,
    required this.onRemove,
    required this.onReplace,
    this.fallbackBytes,
  });

  final ImageUploadInfo uploadInfo;
  final VoidCallback onTap;
  final VoidCallback onRemove;
  final VoidCallback onReplace;

  /// Draft-restored photo (decoded from the persisted draft) shown when the in-memory upload provider has no image.
  final Uint8List? fallbackBytes;

  @override
  Widget build(BuildContext context) {
    Uint8List? bytes;
    if (uploadInfo.state == ImageUploadState.completed &&
        uploadInfo.imageUrl != null) {
      try {
        bytes = base64.decode(uploadInfo.imageUrl!);
      } catch (_) {
        bytes = null;
      }
    }
    bytes ??= fallbackBytes;
    final done = bytes != null;
    final loading = uploadInfo.state == ImageUploadState.uploading;

    return Semantics(
      button: true,
      label: done
          ? 'Cover photo'
          : loading
          ? 'Uploading cover photo'
          : 'Add cover photo',
      child: PressableScale(
        onTap: done || loading ? null : onTap,
        child: AspectRatio(
          aspectRatio: 16 / 9,
          child: DecoratedBox(
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(AppRadius.lg),
              color: context.colors.surfaceInverse,
              image: bytes != null
                  ? DecorationImage(
                      image: MemoryImage(bytes),
                      fit: BoxFit.cover,
                    )
                  : null,
            ),
            child: ClipRRect(
              borderRadius: BorderRadius.circular(AppRadius.lg),
              child: Stack(
                alignment: Alignment.center,
                children: [
                  if (!done && !loading)
                    Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Container(
                          width: 48,
                          height: 48,
                          decoration: BoxDecoration(
                            color: context.colors.textOnPrimary.withValues(
                              alpha: 0.12,
                            ),
                            borderRadius: BorderRadius.circular(AppRadius.md),
                          ),
                          alignment: Alignment.center,
                          child: Icon(
                            Icons.add_photo_alternate_outlined,
                            size: 26,
                            color: context.colors.textOnPrimary,
                          ),
                        ),
                        const SizedBox(height: AppSpacing.x3),
                        Text(
                          'Add a photo of the court or your game',
                          style: AppTypography.labelField(
                            context,
                          ).copyWith(color: context.colors.textOnPrimary),
                        ),
                      ],
                    ),
                  if (loading)
                    ColoredBox(
                      color: context.colors.scrim,
                      child: Center(
                        child: CircularProgressIndicator(
                          valueColor: AlwaysStoppedAnimation<Color>(
                            context.colors.textOnPrimary,
                          ),
                          strokeWidth: 2.5,
                        ),
                      ),
                    ),
                  if (uploadInfo.state == ImageUploadState.failed)
                    ColoredBox(
                      color: context.colors.scrim,
                      child: Center(
                        child: Padding(
                          padding: const EdgeInsets.all(AppSpacing.x4),
                          child: Text(
                            uploadInfo.errorMessage ?? 'Failed',
                            style: AppTypography.labelField(
                              context,
                            ).copyWith(color: context.colors.textOnPrimary),
                            textAlign: TextAlign.center,
                          ),
                        ),
                      ),
                    ),
                  if (done)
                    Positioned(
                      bottom: AppSpacing.x2,
                      right: AppSpacing.x2,
                      child: Row(
                        children: [
                          _PhotoBtn(
                            icon: Icons.edit_rounded,
                            onTap: onReplace,
                            semanticLabel: 'Replace cover photo',
                          ),
                          const SizedBox(width: AppSpacing.x2),
                          _PhotoBtn(
                            icon: Icons.delete_outline_rounded,
                            onTap: onRemove,
                            danger: true,
                            semanticLabel: 'Remove cover photo',
                          ),
                        ],
                      ),
                    ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _PhotoBtn extends StatelessWidget {
  const _PhotoBtn({
    required this.icon,
    required this.onTap,
    required this.semanticLabel,
    this.danger = false,
  });

  final IconData icon;
  final VoidCallback onTap;
  final String semanticLabel;
  final bool danger;

  @override
  Widget build(BuildContext context) {
    final color = danger
        ? context.colors.errorText
        : context.colors.primaryOnSurface;
    return AppTappable(
      onTap: onTap,
      semanticLabel: semanticLabel,
      feedback: AppTapFeedback.scale,
      child: Container(
        width: 34,
        height: 34,
        decoration: BoxDecoration(
          color: context.colors.surface,
          borderRadius: BorderRadius.circular(AppRadius.sm),
          border: Border.all(color: color.withValues(alpha: 0.3)),
          boxShadow: AppShadows.card,
        ),
        alignment: Alignment.center,
        child: Icon(icon, size: 16, color: color),
      ),
    );
  }
}

// ───────────────────────────────────────────────────────────────────────────── Shared form primitives.
