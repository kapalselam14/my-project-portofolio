import 'package:flutter/material.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../core/theme/app_typography.dart';
import '../../../../core/theme/dark_colors.dart';
import '../../../../core/widgets/pressable_scale.dart';

/// The bubble shown alongside a spotlight cut-out: title, body copy, a "current/total" progress label, and Skip /.
/// Pure presentation — every callback is handed in, nothing here touches.
class TourCalloutCard extends StatelessWidget {
  const TourCalloutCard({
    super.key,
    required this.title,
    required this.body,
    required this.currentStep,
    required this.totalSteps,
    required this.isLastStep,
    required this.onSkip,
    required this.onNext,
    this.onBack,
    this.footnote,
  });

  final String title;
  final String body;

  /// 1-based step number for the "2/6" label.
  final int currentStep;
  final int totalSteps;
  final bool isLastStep;
  final VoidCallback onSkip;
  final VoidCallback onNext;

  /// Wired to `TourController.back`.
  final VoidCallback? onBack;

  /// Optional disclosure line under the body (e.g. auto-skipped tips).
  final String? footnote;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      liveRegion: true,
      container: true,
      label: '$title. $body. Step $currentStep of $totalSteps.',
      child: Container(
        constraints: const BoxConstraints(maxWidth: 320),
        padding: const EdgeInsets.all(AppSpacing.x4),
        decoration: BoxDecoration(
          color: context.colors.card,
          borderRadius: BorderRadius.circular(AppRadius.card),
          boxShadow: AppShadows.floating,
          border: Border.all(color: context.colors.border),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Expanded(
                  child: Text(title, style: AppTypography.titleSheet(context)),
                ),
                const SizedBox(width: AppSpacing.x2),
                Text(
                  '$currentStep/$totalSteps',
                  style: AppTypography.metaSub(context).copyWith(
                    color: context.colors.textTertiary,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
            const SizedBox(height: AppSpacing.x2),
            Text(
              body,
              style: AppTypography.bodyFormSecondary(
                context,
              ).copyWith(color: context.colors.textSecondary),
            ),
            if (footnote case final note?) ...[
              const SizedBox(height: AppSpacing.x2),
              Text(
                note,
                style: AppTypography.metaSub(
                  context,
                ).copyWith(color: context.colors.textTertiary),
              ),
            ],
            const SizedBox(height: AppSpacing.x4),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Semantics(
                      button: true,
                      label: 'Skip tour',
                      child: PressableScale(
                        onTap: onSkip,
                        child: Container(
                          constraints: const BoxConstraints(minHeight: 44),
                          padding: const EdgeInsets.symmetric(
                            horizontal: AppSpacing.x2,
                          ),
                          alignment: Alignment.centerLeft,
                          child: Text(
                            'Skip',
                            style: AppTypography.labelField(context).copyWith(
                              color: context.colors.textSecondary,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ),
                      ),
                    ),
                    if (onBack != null)
                      Semantics(
                        button: true,
                        label: 'Back to previous tip',
                        child: PressableScale(
                          onTap: onBack,
                          child: Container(
                            constraints: const BoxConstraints(minHeight: 44),
                            padding: const EdgeInsets.symmetric(
                              horizontal: AppSpacing.x2,
                            ),
                            alignment: Alignment.centerLeft,
                            child: Text(
                              'Back',
                              style: AppTypography.labelField(context).copyWith(
                                color: context.colors.textSecondary,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ),
                        ),
                      ),
                  ],
                ),
                Semantics(
                  button: true,
                  label: isLastStep ? 'Done' : 'Next',
                  child: PressableScale(
                    onTap: onNext,
                    child: Container(
                      constraints: const BoxConstraints(minHeight: 44),
                      padding: const EdgeInsets.symmetric(
                        horizontal: AppSpacing.x5,
                        vertical: AppSpacing.x2,
                      ),
                      decoration: BoxDecoration(
                        color: AppColors.primary,
                        borderRadius: BorderRadius.circular(AppRadius.lg),
                      ),
                      alignment: Alignment.center,
                      child: Text(
                        isLastStep ? 'Done' : 'Next',
                        style: AppTypography.buttonPrimary,
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
