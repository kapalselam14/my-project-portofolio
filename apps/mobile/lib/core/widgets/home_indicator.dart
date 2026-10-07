import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';

import '../theme/app_spacing.dart';
import '../theme/dark_colors.dart';

/// iOS home indicator pill (139×5px, 100px radius) shown at the bottom of every screen to match Figma designs.
/// iOS only: Android draws its own system gesture pill in the same spot.
class HomeIndicator extends StatelessWidget {
  const HomeIndicator({
    super.key,
    this.color,
    this.padding = const EdgeInsets.only(top: 16, bottom: 8),
  });

  /// Defaults to `context.colors.iconPrimary` (theme-aware) when null.
  final Color? color;
  final EdgeInsets padding;

  @override
  Widget build(BuildContext context) {
    // Android (and desktop/web) already show a system gesture pill or navigation buttons.
    if (defaultTargetPlatform != TargetPlatform.iOS) {
      return const SizedBox.shrink();
    }
    return Padding(
      padding: padding,
      child: Center(
        child: Container(
          width: 139,
          height: 5,
          decoration: BoxDecoration(
            color: color ?? context.colors.iconPrimary,
            borderRadius: AppRadius.pillR,
          ),
        ),
      ),
    );
  }
}
