import 'package:flutter/material.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/theme/dark_colors.dart';
import '../../../core/widgets/app_tappable.dart';
import '../../../core/widgets/pressable_scale.dart';

/// Shared building blocks for [ReportUserSheet] and [ReportActivitySheet].
/// Theme note: `errorLight` resolves via token (light value is identical to the old `AppColors.errorLight` literal).

// Header.

class ReportSheetHeader extends StatelessWidget {
  const ReportSheetHeader({
    super.key,
    required this.title,
    required this.onClose,
  });

  final String title;
  final VoidCallback onClose;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.x5,
        AppSpacing.x4,
        AppSpacing.x3,
        AppSpacing.x2,
      ),
      child: Column(
        children: [
          Container(
            width: 36,
            height: 4,
            decoration: BoxDecoration(
              color: context.colors.border,
              borderRadius: BorderRadius.circular(2),
            ),
          ),
          const SizedBox(height: AppSpacing.x3),
          Row(
            children: [
              Expanded(
                child: Text(title, style: AppTypography.titleSheet(context)),
              ),
              PressableScale(
                onTap: onClose,
                child: Container(
                  width: 32,
                  height: 32,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: context.colors.surfaceMuted,
                    shape: BoxShape.circle,
                  ),
                  child: Icon(
                    Icons.close_rounded,
                    size: 18,
                    color: context.colors.textPrimary,
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

// Target card.

class ReportTargetCard extends StatelessWidget {
  const ReportTargetCard({
    super.key,
    required this.heading,
    required this.targetName,
    required this.icon,
  });

  final String heading;
  final String targetName;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(AppSpacing.x4),
      decoration: BoxDecoration(
        color: context.colors.errorLight,
        borderRadius: BorderRadius.circular(AppRadius.card),
        border: Border.all(color: AppColors.danger.withValues(alpha: 0.25)),
      ),
      child: Row(
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: AppColors.danger.withValues(alpha: 0.15),
              shape: BoxShape.circle,
            ),
            alignment: Alignment.center,
            child: Icon(icon, size: 20, color: context.colors.errorText),
          ),
          const SizedBox(width: AppSpacing.x3),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  heading,
                  style: AppTypography.labelField(context).copyWith(
                    color: context.colors.errorText,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  targetName,
                  style: AppTypography.metaSub(context).copyWith(
                    color: context.colors.errorText,
                    fontWeight: FontWeight.w500,
                  ),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// Reasons list.

class ReportReasonsCard extends StatelessWidget {
  const ReportReasonsCard({
    super.key,
    required this.reasons,
    required this.selected,
    required this.onSelect,
  });

  final List<String> reasons;
  final String? selected;
  final ValueChanged<String> onSelect;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: context.colors.surface,
        borderRadius: BorderRadius.circular(AppRadius.card),
        border: Border.all(color: context.colors.border),
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        children: List.generate(reasons.length, (i) {
          final r = reasons[i];
          final isSelected = r == selected;
          final isLast = i == reasons.length - 1;
          return Column(
            children: [
              AppTappable(
                semanticLabel: r,
                onTap: () => onSelect(r),
                minSize: 44,
                child: Padding(
                  padding: const EdgeInsets.symmetric(
                    horizontal: AppSpacing.x4,
                    vertical: AppSpacing.x3,
                  ),
                  child: Row(
                    children: [
                      AnimatedContainer(
                        duration: const Duration(milliseconds: 150),
                        width: 22,
                        height: 22,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: isSelected
                              ? AppColors.primary
                              : Colors.transparent,
                          border: Border.all(
                            color: isSelected
                                ? AppColors.primary
                                : context.colors.border,
                            width: isSelected ? 0 : 1.5,
                          ),
                        ),
                        alignment: Alignment.center,
                        child: isSelected
                            ? Icon(
                                Icons.check_rounded,
                                size: 13,
                                color: context.colors.textOnPrimary,
                              )
                            : null,
                      ),
                      const SizedBox(width: AppSpacing.x3),
                      Expanded(
                        child: Text(
                          r,
                          style: AppTypography.bodyMedium(context).copyWith(
                            color: isSelected
                                ? context.colors.textPrimary
                                : context.colors.textSecondary,
                            fontWeight: isSelected
                                ? FontWeight.w600
                                : FontWeight.w400,
                            fontSize: 15,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              if (!isLast)
                Divider(
                  height: 1,
                  color: context.colors.border,
                  indent: AppSpacing.x4 + 22 + AppSpacing.x3,
                ),
            ],
          );
        }),
      ),
    );
  }
}

// Details field.

class ReportDetailsField extends StatelessWidget {
  const ReportDetailsField({super.key, required this.controller});

  final TextEditingController controller;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Additional details',
          style: AppTypography.labelField(
            context,
          ).copyWith(fontWeight: FontWeight.w700),
        ),
        const SizedBox(height: 4),
        Text(
          'Optional — help us understand the issue better',
          style: AppTypography.metaSub(context),
        ),
        const SizedBox(height: AppSpacing.x3),
        Container(
          decoration: BoxDecoration(
            color: context.colors.surfaceMuted,
            borderRadius: BorderRadius.circular(AppRadius.input),
            border: Border.all(color: context.colors.border),
          ),
          padding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.x4,
            vertical: AppSpacing.x3,
          ),
          child: TextField(
            controller: controller,
            minLines: 3,
            maxLines: 5,
            cursorColor: AppColors.primary,
            cursorWidth: 1.5,
            style: AppTypography.bodyReading(context),
            decoration: InputDecoration(
              hintText: 'Describe the issue...',
              hintStyle: AppTypography.bodyReading(
                context,
              ).copyWith(color: context.colors.textTertiary),
              filled: true,
              fillColor: Colors.transparent,
              border: InputBorder.none,
              enabledBorder: InputBorder.none,
              focusedBorder: InputBorder.none,
              isDense: true,
              contentPadding: EdgeInsets.zero,
            ),
          ),
        ),
      ],
    );
  }
}

// Disclaimer.

class ReportDisclaimer extends StatelessWidget {
  const ReportDisclaimer({super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(AppSpacing.x4),
      decoration: BoxDecoration(
        color: context.colors.surfaceMuted,
        borderRadius: BorderRadius.circular(AppRadius.card),
        border: Border.all(color: context.colors.border),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(
            Icons.info_outline_rounded,
            size: 18,
            color: context.colors.textSecondary,
          ),
          const SizedBox(width: AppSpacing.x2),
          Expanded(
            child: Text(
              'Your report will be reviewed by our moderation team. False reports may result in account restrictions.',
              style: AppTypography.metaSub(context),
            ),
          ),
        ],
      ),
    );
  }
}

// Submit bar.

class ReportSubmitBar extends StatelessWidget {
  const ReportSubmitBar({
    super.key,
    required this.submitting,
    required this.onSubmit,
  });

  final bool submitting;
  final VoidCallback onSubmit;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.fromLTRB(
        AppSpacing.x5,
        AppSpacing.x3,
        AppSpacing.x5,
        AppSpacing.x3 + MediaQuery.of(context).padding.bottom,
      ),
      decoration: BoxDecoration(
        color: context.colors.surface,
        boxShadow: AppShadows.bottomBar,
      ),
      child: PressableScale(
        onTap: submitting ? null : onSubmit,
        child: Container(
          width: double.infinity,
          height: 52,
          decoration: BoxDecoration(
            color: submitting
                ? AppColors.danger.withValues(alpha: 0.6)
                : AppColors.danger,
            borderRadius: BorderRadius.circular(AppRadius.pill),
          ),
          alignment: Alignment.center,
          child: submitting
              ? SizedBox(
                  width: 22,
                  height: 22,
                  child: CircularProgressIndicator(
                    strokeWidth: 2.5,
                    valueColor: AlwaysStoppedAnimation(
                      context.colors.textOnPrimary,
                    ),
                  ),
                )
              : Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(
                      Icons.flag_rounded,
                      size: 18,
                      color: context.colors.textOnPrimary,
                    ),
                    const SizedBox(width: AppSpacing.x2),
                    Text('Submit Report', style: AppTypography.buttonPrimary),
                  ],
                ),
        ),
      ),
    );
  }
}
