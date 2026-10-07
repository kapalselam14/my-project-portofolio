import 'package:flutter/material.dart';

import '../theme/app_colors.dart';
import '../theme/app_spacing.dart';
import '../theme/dark_colors.dart';

/// Standard card surface for MatchUp.
/// Separates itself from the page background with a two-layer shadow.
/// Every tap gets a real ripple — the layering is `DecoratedBox`.
/// ```dart AppCard( onTap: () {}, child: ..., ) ```.
class AppCard extends StatelessWidget {
  const AppCard({
    super.key,
    required this.child,
    this.onTap,
    this.padding = const EdgeInsets.all(AppSpacing.x5),
    this.radius = AppRadius.card,
    this.color,
    this.border = false,
    this.shadow = true,
  });

  final Widget child;
  final VoidCallback? onTap;
  final EdgeInsetsGeometry padding;
  final double radius;

  /// Card surface colour.
  final Color? color;
  final bool border;
  final bool shadow;

  @override
  Widget build(BuildContext context) {
    final borderRadius = BorderRadius.circular(radius);
    return DecoratedBox(
      decoration: BoxDecoration(
        borderRadius: borderRadius,
        boxShadow: shadow ? AppShadows.card : null,
      ),
      child: Material(
        color: color ?? context.colors.card,
        borderRadius: borderRadius,
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: onTap,
          // Kept intentionally faint — the ripple should confirm the tap registered, not compete with the card's own.
          splashColor: AppColors.primary.withValues(alpha: 0.06),
          highlightColor: AppColors.primary.withValues(alpha: 0.03),
          child: Container(
            decoration: BoxDecoration(
              borderRadius: borderRadius,
              border: border ? Border.all(color: context.colors.border) : null,
            ),
            child: Padding(padding: padding, child: child),
          ),
        ),
      ),
    );
  }
}
