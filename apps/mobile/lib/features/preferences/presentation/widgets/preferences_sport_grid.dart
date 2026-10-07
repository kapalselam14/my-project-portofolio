import 'package:flutter/material.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../core/theme/app_typography.dart';
import '../../../../core/theme/dark_colors.dart';
import '../../../../core/widgets/app_tappable.dart';
import 'preference_types.dart';

/// 3-column grid of sport cards, each showing its selected skill level abbreviation (or a plain "+" affordance when.
class PreferencesSportGrid extends StatelessWidget {
  const PreferencesSportGrid({
    super.key,
    required this.sports,
    required this.selected,
    required this.onTap,
  });

  final List<SportOption> sports;
  final Map<String, SkillLevel> selected;
  final void Function(SportOption) onTap;

  @override
  Widget build(BuildContext context) {
    return GridView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 3,
        // Tighter gutters (was 12px) so the grid reads as one connected block instead of loosely scattered cards.
        crossAxisSpacing: AppSpacing.x2,
        mainAxisSpacing: AppSpacing.x2,
        childAspectRatio: 0.86,
      ),
      itemCount: sports.length,
      itemBuilder: (_, i) {
        final opt = sports[i];
        return _SportCard(
          option: opt,
          level: selected[opt.name],
          onTap: () => onTap(opt),
        );
      },
    );
  }
}

class _SportCard extends StatelessWidget {
  const _SportCard({
    required this.option,
    required this.level,
    required this.onTap,
  });

  final SportOption option;
  final SkillLevel? level;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final selected = level != null;
    return AppTappable(
      semanticLabel: selected
          ? '${option.name}, ${level!.label}'
          : '${option.name}, not selected',
      onTap: onTap,
      minSize: 0,
      borderRadius: AppRadius.card,
      child: AnimatedContainer(
        duration: AppDurations.fast,
        curve: Curves.easeOut,
        // Was 8/14 — the icon well only needed 44px of that but the card kept ~24px of dead air above and below it.
        padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.x2,
          vertical: AppSpacing.x2,
        ),
        decoration: BoxDecoration(
          color: selected ? context.colors.primarySoft : context.colors.surface,
          borderRadius: AppRadius.cardR,
          border: Border.all(
            color: selected ? AppColors.primary : context.colors.border,
            width: selected ? 1.5 : 1,
          ),
          boxShadow: selected ? AppShadows.card : null,
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            // 56px well + 26px glyph (was 44px / 22px).
            Container(
              width: 56,
              height: 56,
              decoration: BoxDecoration(
                color: selected
                    ? AppColors.primary
                    : context.colors.surfaceSubtle,
                borderRadius: AppRadius.mdR,
              ),
              child: Icon(
                option.icon,
                size: 26,
                color: selected
                    ? AppColors.textOnPrimary
                    : context.colors.textPrimary,
              ),
            ),
            const SizedBox(height: AppSpacing.x2),
            Text(
              option.name,
              textAlign: TextAlign.center,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: AppTypography.chipLabel(context).copyWith(
                color: selected
                    ? context.colors.primaryOnSurface
                    : context.colors.textLabel,
              ),
            ),
            const SizedBox(height: AppSpacing.x1),
            SizedBox(
              height: 16,
              child: selected
                  ? Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          level!.short,
                          style: AppTypography.caption(context).copyWith(
                            fontSize: 10,
                            fontWeight: FontWeight.w700,
                            color: AppColors.primary,
                            letterSpacing: 0.3,
                          ),
                        ),
                        const SizedBox(width: 2),
                        const Icon(
                          Icons.expand_more,
                          size: 12,
                          color: AppColors.primary,
                        ),
                      ],
                    )
                  : Icon(
                      Icons.add,
                      size: 14,
                      color: context.colors.textTertiary,
                    ),
            ),
          ],
        ),
      ),
    );
  }
}
