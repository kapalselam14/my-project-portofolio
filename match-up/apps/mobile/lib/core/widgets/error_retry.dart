import 'package:flutter/material.dart';

import '../theme/app_colors.dart';
import '../theme/app_spacing.dart';
import '../theme/app_typography.dart';
import '../theme/dark_colors.dart';
import 'app_button.dart';

/// Full-page error state with retry CTA, tinted [AppColors.danger].
/// Visually the same family as [EmptyState].
class ErrorRetry extends StatelessWidget {
  const ErrorRetry({
    super.key,
    this.message = "Couldn't load this. Please try again.",
    required this.onRetry,
  });

  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: AppSpacing.x8),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 72,
              height: 72,
              decoration: BoxDecoration(
                color: context.colors.errorLight,
                shape: BoxShape.circle,
              ),
              child: Icon(
                Icons.wifi_off_rounded,
                size: 32,
                color: context.colors.errorText,
              ),
            ),
            const SizedBox(height: AppSpacing.x5),
            Text(
              "Something didn't load",
              textAlign: TextAlign.center,
              style: AppTypography.titleSheet(context),
            ),
            const SizedBox(height: AppSpacing.x2),
            Text(
              message,
              textAlign: TextAlign.center,
              style: AppTypography.bodyReading(
                context,
              ).copyWith(color: context.colors.textSecondary),
            ),
            const SizedBox(height: AppSpacing.x6),
            AppButton(
              label: 'Try again',
              onPressed: onRetry,
              expand: false,
              size: AppButtonSize.sm,
            ),
          ],
        ),
      ),
    );
  }
}
