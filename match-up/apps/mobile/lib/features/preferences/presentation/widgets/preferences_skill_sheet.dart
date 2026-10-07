import 'package:flutter/material.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../core/theme/app_typography.dart';
import '../../../../core/theme/dark_colors.dart';
import '../../../../core/widgets/pressable_scale.dart';
import 'preference_types.dart';

/// Sentinel returned via `Navigator.pop` when the user removes a sport instead of picking a skill level.
const Object kClearSportAction = Object();

/// Bottom sheet for picking (or removing) a skill level for one sport.
class PreferencesSkillSheet extends StatefulWidget {
  const PreferencesSkillSheet({
    super.key,
    required this.sportName,
    required this.sportIcon,
    required this.current,
  });

  final String sportName;
  final IconData sportIcon;
  final SkillLevel? current;

  @override
  State<PreferencesSkillSheet> createState() => _PreferencesSkillSheetState();
}

class _PreferencesSkillSheetState extends State<PreferencesSkillSheet> {
  late SkillLevel _draft = widget.current ?? SkillLevel.beginner;

  void _save() => Navigator.of(context).pop(_draft);

  void _remove() => Navigator.of(context).pop(kClearSportAction);

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      top: false,
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
          AppSpacing.x5,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(
              child: Container(
                width: 40,
                height: 4,
                margin: const EdgeInsets.only(bottom: AppSpacing.x4),
                decoration: BoxDecoration(
                  color: context.colors.border,
                  borderRadius: AppRadius.xsR,
                ),
              ),
            ),
            Row(
              children: [
                Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    color: context.colors.primarySoft,
                    borderRadius: AppRadius.smR,
                  ),
                  child: Icon(
                    widget.sportIcon,
                    size: 22,
                    color: AppColors.primary,
                  ),
                ),
                const SizedBox(width: AppSpacing.x3),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        widget.sportName,
                        style: AppTypography.titleSheet(context),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        'Pick your skill level',
                        style: AppTypography.metaSub(context),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: AppSpacing.x5),
            _SegmentedSkill(
              value: _draft,
              onChanged: (v) => setState(() => _draft = v),
            ),
            const SizedBox(height: AppSpacing.x6),
            Row(
              children: [
                if (widget.current != null) ...[
                  Expanded(
                    child: PressableScale(
                      onTap: _remove,
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                          vertical: AppSpacing.x3 + 2,
                        ),
                        decoration: BoxDecoration(
                          color: context.colors.surface,
                          borderRadius: AppRadius.pillR,
                          border: Border.all(color: context.colors.border),
                        ),
                        child: Center(
                          child: Text(
                            'Remove',
                            style: AppTypography.labelField(
                              context,
                            ).copyWith(color: context.colors.errorText),
                          ),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: AppSpacing.x3),
                ],
                Expanded(
                  flex: 2,
                  child: PressableScale(
                    onTap: _save,
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                        vertical: AppSpacing.x3 + 2,
                      ),
                      decoration: BoxDecoration(
                        color: AppColors.primary,
                        borderRadius: AppRadius.pillR,
                      ),
                      child: Center(
                        child: Text(
                          'Done',
                          style: AppTypography.labelField(
                            context,
                          ).copyWith(color: AppColors.textOnPrimary),
                        ),
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

class _SegmentedSkill extends StatelessWidget {
  const _SegmentedSkill({required this.value, required this.onChanged});

  final SkillLevel value;
  final ValueChanged<SkillLevel> onChanged;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: context.colors.surfaceSubtle,
        borderRadius: AppRadius.mdR,
        border: Border.all(color: context.colors.border),
      ),
      child: Row(
        children: [
          for (final s in SkillLevel.values)
            Expanded(
              child: _SegmentButton(
                label: s.label,
                selected: s == value,
                onTap: () => onChanged(s),
              ),
            ),
        ],
      ),
    );
  }
}

class _SegmentButton extends StatelessWidget {
  const _SegmentButton({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return PressableScale(
      onTap: onTap,
      child: AnimatedContainer(
        duration: AppDurations.fast,
        curve: Curves.easeOut,
        padding: const EdgeInsets.symmetric(vertical: AppSpacing.x2 + 2),
        decoration: BoxDecoration(
          color: selected ? AppColors.primary : Colors.transparent,
          borderRadius: AppRadius.smR,
        ),
        child: Center(
          child: Text(
            label,
            style: AppTypography.chipLabel(context).copyWith(
              color: selected
                  ? AppColors.textOnPrimary
                  : context.colors.textLabel,
            ),
          ),
        ),
      ),
    );
  }
}
