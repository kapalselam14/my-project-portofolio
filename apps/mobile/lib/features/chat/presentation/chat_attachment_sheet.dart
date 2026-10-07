import 'package:flutter/material.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/theme/dark_colors.dart';
import '../../../core/widgets/pressable_scale.dart';

/// Result returned by [ChatAttachmentSheet] via `Navigator.pop`.
enum ChatAttachmentChoice { photo, camera, location, poll }

/// Bottom sheet for the chat composer's `+` button.
class ChatAttachmentSheet extends StatelessWidget {
  const ChatAttachmentSheet({super.key, this.includePoll = true});
  final bool includePoll;

  static Future<ChatAttachmentChoice?> show(
    BuildContext context, {
    bool includePoll = true,
  }) {
    return showModalBottomSheet<ChatAttachmentChoice>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => ChatAttachmentSheet(includePoll: includePoll),
    );
  }

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Container(
        decoration: BoxDecoration(
          color: context.colors.surface,
          borderRadius: const BorderRadius.vertical(
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

            Text(
              'Add to Message',
              style: AppTypography.titleLarge(
                context,
              ).copyWith(fontWeight: FontWeight.w800, fontSize: 18),
            ),

            const SizedBox(height: AppSpacing.x6),

            _AttachmentOption(
              icon: Icons.photo_library_outlined,
              label: 'Gallery',
              color: AppColors.primary,
              onTap: () =>
                  Navigator.of(context).pop(ChatAttachmentChoice.photo),
            ),
            const SizedBox(height: AppSpacing.x3),
            _AttachmentOption(
              icon: Icons.camera_alt_outlined,
              label: 'Camera',
              color: AppColors.primary,
              onTap: () =>
                  Navigator.of(context).pop(ChatAttachmentChoice.camera),
            ),
            const SizedBox(height: AppSpacing.x3),
            _AttachmentOption(
              icon: Icons.location_on_outlined,
              label: 'Share Location',
              color: AppColors.accent,
              onTap: () =>
                  Navigator.of(context).pop(ChatAttachmentChoice.location),
            ),
            const SizedBox(height: AppSpacing.x3),
            if (includePoll)
              _AttachmentOption(
                icon: Icons.bar_chart_outlined,
                label: 'Create Poll',
                color: AppColors.primary,
                onTap: () =>
                    Navigator.of(context).pop(ChatAttachmentChoice.poll),
              ),
            if (includePoll) const SizedBox(height: AppSpacing.x3),

            const SizedBox(height: AppSpacing.x6),

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

class _AttachmentOption extends StatelessWidget {
  const _AttachmentOption({
    required this.icon,
    required this.label,
    required this.color,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final Color color;
  final VoidCallback onTap;

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
            Icon(icon, color: color, size: 28),
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
