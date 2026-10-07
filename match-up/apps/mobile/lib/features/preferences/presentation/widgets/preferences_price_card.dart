import 'package:flutter/material.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../core/theme/app_typography.dart';
import '../../../../core/theme/dark_colors.dart';
import '../../../../core/widgets/pressable_scale.dart';
import 'preference_types.dart';

/// 3-segment price preference selector (Free / Paid / Both).
class PreferencesPriceCard extends StatelessWidget {
  const PreferencesPriceCard({
    super.key,
    required this.value,
    required this.onChanged,
  });

  final PricePreference value;
  final ValueChanged<PricePreference> onChanged;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(AppSpacing.x2),
      decoration: BoxDecoration(
        color: context.colors.surface,
        borderRadius: AppRadius.cardR,
        border: Border.all(color: context.colors.border),
      ),
      child: Row(
        children: [
          for (final p in PricePreference.values) ...[
            Expanded(
              child: _PriceChip(
                option: p,
                selected: p == value,
                onTap: () => onChanged(p),
              ),
            ),
            if (p != PricePreference.both) const SizedBox(width: AppSpacing.x2),
          ],
        ],
      ),
    );
  }
}

class _PriceChip extends StatelessWidget {
  const _PriceChip({
    required this.option,
    required this.selected,
    required this.onTap,
  });

  final PricePreference option;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: option.label,
      selected: selected,
      child: PressableScale(
        onTap: onTap,
        child: AnimatedContainer(
          duration: AppDurations.fast,
          curve: Curves.easeOut,
          padding: const EdgeInsets.symmetric(vertical: AppSpacing.x3 + 2),
          decoration: BoxDecoration(
            color: selected ? AppColors.primary : context.colors.surfaceSubtle,
            borderRadius: AppRadius.smR,
            border: Border.all(
              color: selected ? AppColors.primary : Colors.transparent,
            ),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                option.icon,
                size: 20,
                color: selected
                    ? AppColors.textOnPrimary
                    : context.colors.textPrimary,
              ),
              const SizedBox(height: AppSpacing.x1 + 2),
              Text(
                option.label,
                style: AppTypography.chipLabel(context).copyWith(
                  color: selected
                      ? AppColors.textOnPrimary
                      : context.colors.textLabel,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
