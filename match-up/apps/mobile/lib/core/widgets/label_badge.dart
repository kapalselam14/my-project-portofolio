import 'package:flutter/material.dart';

import '../theme/app_spacing.dart';
import '../theme/app_typography.dart';
import '../theme/dark_colors.dart';

/// Pill-shaped label matching Figma activity badges.
class LabelBadge extends StatelessWidget {
  const LabelBadge({
    super.key,
    required this.label,
    required this.background,
    required this.foreground,
    this.fontSize = 11,
    this.padding = const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
  });

  final String label;
  final Color background;
  final Color foreground;
  final double fontSize;
  final EdgeInsets padding;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: padding,
      decoration: BoxDecoration(
        color: background,
        borderRadius: AppRadius.pillR,
      ),
      child: Text(
        label,
        style: AppTypography.bodySmall(context).copyWith(
          color: foreground,
          fontSize: fontSize,
          fontWeight: FontWeight.w700,
          height: 1.0,
        ),
      ),
    );
  }
}

/// Status badge variant that derives its colors from a [StatusTone].
enum StatusTone { checkedIn, pending }

class StatusBadge extends StatelessWidget {
  const StatusBadge({super.key, required this.label, required this.tone});

  final String label;
  final StatusTone tone;

  @override
  Widget build(BuildContext context) {
    final isChecked = tone == StatusTone.checkedIn;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        // Was a separately hardcoded #D1FAE5/#097044 pair.
        color: isChecked
            ? context.colors.statusSuccessBg
            : context.colors.surface,
        borderRadius: AppRadius.pillR,
        border: isChecked ? null : Border.all(color: context.colors.border),
      ),
      child: Text(
        label,
        style: AppTypography.bodySmall(context).copyWith(
          color: isChecked
              ? context.colors.successText
              : context.colors.textSecondary,
          fontSize: 11,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }
}
