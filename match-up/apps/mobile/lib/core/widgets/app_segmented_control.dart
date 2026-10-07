import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../theme/app_spacing.dart';
import '../theme/app_typography.dart';
import '../theme/dark_colors.dart';
import 'pressable_scale.dart';

/// Pill-style segmented control (like iOS UISegmentedControl) used for tabs that don't need full navigation.
/// The selected thumb is a real sliding pill ([AnimatedPositioned] over a [LayoutBuilder] width).
/// Usage: see the constructors below.
class AppSegmentedControl extends StatelessWidget {
  const AppSegmentedControl({
    super.key,
    required this.labels,
    required this.selectedIndex,
    required this.onChanged,
    this.height = 46,
    this.activeLabelColor,
  });

  final List<String> labels;
  final int selectedIndex;
  final ValueChanged<int> onChanged;
  final double height;

  /// Colour of the selected segment's label.
  final Color? activeLabelColor;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: height,
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: context.colors.surfaceSubtle,
        borderRadius: BorderRadius.circular(AppRadius.md),
        border: Border.all(color: context.colors.border),
      ),
      child: LayoutBuilder(
        builder: (context, constraints) {
          final segW = constraints.maxWidth / labels.length;
          return Stack(
            children: [
              // Sliding thumb — glides between segments instead of snapping.
              AnimatedPositioned(
                duration: AppDurations.base,
                curve: Curves.easeOutCubic,
                left: selectedIndex * segW,
                top: 0,
                bottom: 0,
                width: segW,
                child: Container(
                  decoration: BoxDecoration(
                    color: context.colors.surface,
                    borderRadius: BorderRadius.circular(AppRadius.sm),
                    boxShadow: AppShadows.card,
                  ),
                ),
              ),
              Row(
                children: List.generate(labels.length, (i) {
                  final selected = i == selectedIndex;
                  return SizedBox(
                    width: segW,
                    height: double.infinity,
                    child: PressableScale(
                      onTap: () {
                        if (i != selectedIndex) {
                          HapticFeedback.selectionClick();
                          onChanged(i);
                        }
                      },
                      child: Center(
                        child: AnimatedDefaultTextStyle(
                          duration: AppDurations.fast,
                          curve: Curves.easeOut,
                          style: AppTypography.bodyMedium(context).copyWith(
                            fontSize: 13,
                            fontWeight: selected
                                ? FontWeight.w700
                                : FontWeight.w500,
                            color: selected
                                ? (activeLabelColor ??
                                      context.colors.primaryOnSurface)
                                : context.colors.textSecondary,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          child: Text(labels[i]),
                        ),
                      ),
                    ),
                  );
                }),
              ),
            ],
          );
        },
      ),
    );
  }
}
