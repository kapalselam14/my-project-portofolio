import 'package:flutter/material.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../core/theme/app_typography.dart';
import '../../../../core/theme/dark_colors.dart';
import 'preference_types.dart';

/// Summary card at the top of Preferences: how many sports are selected, the dominant skill level.
class PreferencesHeroSummary extends StatelessWidget {
  const PreferencesHeroSummary({
    super.key,
    required this.count,
    required this.dominant,
    required this.distribution,
    required this.onReset,
  });

  final int count;
  final SkillLevel? dominant;
  final Map<SkillLevel, int> distribution;
  final VoidCallback? onReset;

  @override
  Widget build(BuildContext context) {
    final subtitle = count == 0
        ? 'Pick the sports you play'
        : 'Mostly ${dominant?.label ?? '—'}';
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.x5,
        AppSpacing.x4 + 2,
        AppSpacing.x5,
        AppSpacing.x5,
      ),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [context.colors.primarySoft, context.colors.surface],
        ),
        borderRadius: AppRadius.lgR,
        border: Border.all(color: context.colors.primaryLight, width: 1),
        boxShadow: AppShadows.card,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  color: AppColors.primary,
                  borderRadius: AppRadius.smR,
                ),
                child: const Icon(
                  Icons.bolt,
                  size: 20,
                  color: AppColors.textOnPrimary,
                ),
              ),
              const SizedBox(width: AppSpacing.x3),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      count == 0
                          ? 'No sports selected'
                          : '$count ${count == 1 ? 'sport' : 'sports'} selected',
                      style: AppTypography.titleSheet(context),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      subtitle,
                      style: AppTypography.metaSub(context).copyWith(
                        fontStyle: count == 0
                            ? FontStyle.italic
                            : FontStyle.normal,
                      ),
                    ),
                  ],
                ),
              ),
              if (onReset != null)
                TextButton(
                  onPressed: onReset,
                  style: TextButton.styleFrom(
                    foregroundColor: AppColors.primary,
                    padding: const EdgeInsets.symmetric(
                      horizontal: AppSpacing.x2 + 2,
                      vertical: AppSpacing.x1 + 2,
                    ),
                    minimumSize: const Size(0, 32),
                    tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                  ),
                  child: Text(
                    'Reset',
                    style: AppTypography.chipLabel(
                      context,
                    ).copyWith(color: AppColors.primary),
                  ),
                ),
            ],
          ),
          if (count > 0) ...[
            const SizedBox(height: AppSpacing.x4),
            _SkillDistributionBars(dist: distribution),
          ],
        ],
      ),
    );
  }
}

class _SkillDistributionBars extends StatelessWidget {
  const _SkillDistributionBars({required this.dist});

  final Map<SkillLevel, int> dist;

  @override
  Widget build(BuildContext context) {
    final total = dist.values.fold<int>(0, (a, b) => a + b);
    if (total == 0) return const SizedBox.shrink();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            for (final s in SkillLevel.values)
              Expanded(
                child: Text(
                  s.label,
                  textAlign: TextAlign.left,
                  style: AppTypography.caption(
                    context,
                  ).copyWith(fontWeight: FontWeight.w600),
                ),
              ),
          ],
        ),
        const SizedBox(height: AppSpacing.x1 + 2),
        Row(
          children: [
            for (final s in SkillLevel.values) ...[
              Expanded(
                flex: (dist[s] ?? 0).clamp(0, 1000),
                child: Container(
                  height: 6,
                  decoration: BoxDecoration(
                    color: s.color(context),
                    // Pill radius on a 6px-tall bar renders identically to a small fixed radius.
                    borderRadius: AppRadius.pillR,
                  ),
                ),
              ),
              if (s != SkillLevel.advanced)
                const SizedBox(width: AppSpacing.x1),
            ],
          ],
        ),
      ],
    );
  }
}
