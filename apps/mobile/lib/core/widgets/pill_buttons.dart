import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart' show SvgPicture;

import '../theme/app_colors.dart';
import '../theme/app_typography.dart';

/// Primary pill button matching Figma (`border-radius: 100px`, 16px vertical padding, 24px horizontal padding, white.
class PrimaryPillButton extends StatelessWidget {
  const PrimaryPillButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.icon,
    this.background = AppColors.primary,
    this.foreground = AppColors.textOnPrimary,
  });

  final String label;
  final VoidCallback? onPressed;
  final String? icon; // path to an SVG asset
  final Color background;
  final Color foreground;

  @override
  Widget build(BuildContext context) {
    final disabled = onPressed == null;
    return Semantics(
      button: true,
      label: label,
      child: SizedBox(
        width: double.infinity,
        child: Material(
          color: disabled ? background.withValues(alpha: 0.6) : background,
          shape: const StadiumBorder(),
          child: InkWell(
            customBorder: const StadiumBorder(),
            onTap: onPressed,
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    label,
                    style: AppTypography.buttonPrimary.copyWith(
                      color: foreground,
                    ),
                  ),
                  if (icon != null) ...[
                    const SizedBox(width: 10),
                    SizedBox(
                      width: 18,
                      height: 18,
                      child: SvgPicture.asset(
                        icon!,
                        colorFilter: ColorFilter.mode(
                          foreground,
                          BlendMode.srcIn,
                        ),
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
