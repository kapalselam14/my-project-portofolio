import 'package:flutter/material.dart';

import '../../../../../core/theme/app_colors.dart';
import '../../../../../core/theme/app_spacing.dart';
import '../../../../../core/theme/app_typography.dart';
import '../../../../../core/theme/dark_colors.dart';
import '../../../../../core/widgets/pressable_scale.dart';

/// Result returned by [ImagePickerModal] via `Navigator.pop`.
enum ImageSourceChoice { gallery, camera }

/// Image picker modal with Gallery and Camera options.
/// Returns the chosen [ImageSourceChoice] through `Navigator.pop`, or `null` when the user cancels.
class ImagePickerModal extends StatelessWidget {
  const ImagePickerModal({super.key});

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Container(
        decoration: BoxDecoration(
          color: context.colors.surface,
          borderRadius: BorderRadius.vertical(
            top: Radius.circular(AppRadius.xl),
          ),
        ),
        padding: const EdgeInsets.fromLTRB(
          AppSpacing.x6,
          AppSpacing.x3,
          AppSpacing.x6,
          AppSpacing.x6,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // Drag handle
            Container(
              width: 40,
              height: 4,
              margin: const EdgeInsets.only(bottom: AppSpacing.x4),
              decoration: BoxDecoration(
                color: context.colors.border,
                borderRadius: AppRadius.pillR,
              ),
            ),

            // Header
            Text(
              'Select Image Source',
              style: AppTypography.titleLarge(
                context,
              ).copyWith(fontWeight: FontWeight.w800, fontSize: 18),
            ),

            const SizedBox(height: AppSpacing.x6),

            // Gallery option
            _SourceOption(
              icon: Icons.photo_library_outlined,
              label: 'Gallery',
              color: AppColors.primary,
              onTap: () => Navigator.of(context).pop(ImageSourceChoice.gallery),
            ),

            const SizedBox(height: AppSpacing.x3),

            // Camera option
            _SourceOption(
              icon: Icons.camera_alt_outlined,
              label: 'Camera',
              color: AppColors.primary,
              onTap: () => Navigator.of(context).pop(ImageSourceChoice.camera),
            ),

            const SizedBox(height: AppSpacing.x6),

            // Cancel button
            SizedBox(
              width: double.infinity,
              child: PressableScale(
                onTap: () => Navigator.of(context).pop(),
                child: Container(
                  padding: const EdgeInsets.symmetric(vertical: AppSpacing.x4),
                  decoration: BoxDecoration(
                    color: context.colors.surface,
                    borderRadius: BorderRadius.circular(AppRadius.pill),
                    border: Border.all(color: context.colors.border),
                  ),
                  child: Center(
                    child: Text(
                      'Cancel',
                      style: AppTypography.bodyMedium(context).copyWith(
                        color: context.colors.textSecondary,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Single image source option
class _SourceOption extends StatelessWidget {
  final IconData icon;
  final String label;
  final Color color;
  final VoidCallback onTap;

  const _SourceOption({
    required this.icon,
    required this.label,
    required this.color,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return PressableScale(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(
          vertical: AppSpacing.x4,
          horizontal: AppSpacing.x5,
        ),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.1),
          borderRadius: BorderRadius.circular(AppRadius.md),
          border: Border.all(color: color.withValues(alpha: 0.3)),
        ),
        child: Row(
          children: [
            Icon(icon, color: color, size: 32),
            const SizedBox(width: AppSpacing.x4),
            Expanded(
              child: Text(
                label,
                style: AppTypography.bodyMedium(context).copyWith(
                  color: context.colors.textPrimary,
                  fontWeight: FontWeight.w600,
                  fontSize: 15,
                ),
              ),
            ),
            Icon(
              Icons.arrow_forward_ios,
              color: context.colors.textSecondary,
              size: 16,
            ),
          ],
        ),
      ),
    );
  }
}
