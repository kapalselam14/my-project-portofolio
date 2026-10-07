import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../theme/app_colors.dart';
import '../theme/app_spacing.dart';
import '../theme/app_typography.dart';
import '../theme/dark_colors.dart';
import 'pressable_scale.dart';

/// Unified button for MatchUp.
/// Variants: [AppButtonVariant.primary], [.secondary], [.ghost], [.danger].
/// dart AppButton(label: 'Join', onPressed: _join) AppButton.secondary(label: 'Cancel', onPressed: _cancel).
enum AppButtonVariant { primary, secondary, ghost, danger }

enum AppButtonSize { sm, md, lg }

class AppButton extends StatelessWidget {
  const AppButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.variant = AppButtonVariant.primary,
    this.size = AppButtonSize.md,
    this.leading,
    this.trailing,
    this.loading = false,
    this.expand = true,
  });

  /// Convenience constructors
  const AppButton.secondary({
    Key? key,
    required String label,
    required VoidCallback? onPressed,
    AppButtonSize size = AppButtonSize.md,
    Widget? leading,
    bool loading = false,
    bool expand = true,
  }) : this(
         key: key,
         label: label,
         onPressed: onPressed,
         variant: AppButtonVariant.secondary,
         size: size,
         leading: leading,
         loading: loading,
         expand: expand,
       );

  const AppButton.ghost({
    Key? key,
    required String label,
    required VoidCallback? onPressed,
    AppButtonSize size = AppButtonSize.md,
    bool expand = true,
  }) : this(
         key: key,
         label: label,
         onPressed: onPressed,
         variant: AppButtonVariant.ghost,
         size: size,
         expand: expand,
       );

  const AppButton.danger({
    Key? key,
    required String label,
    required VoidCallback? onPressed,
    AppButtonSize size = AppButtonSize.md,
    bool expand = true,
  }) : this(
         key: key,
         label: label,
         onPressed: onPressed,
         variant: AppButtonVariant.danger,
         size: size,
         expand: expand,
       );

  final String label;
  final VoidCallback? onPressed;
  final AppButtonVariant variant;
  final AppButtonSize size;
  final Widget? leading;
  final Widget? trailing;
  final bool loading;
  final bool expand;

  bool get _disabled => onPressed == null || loading;

  // Style resolution.

  Color _bg(BuildContext context) => switch (variant) {
    AppButtonVariant.primary => AppColors.primary,
    AppButtonVariant.secondary => context.colors.surface,
    AppButtonVariant.ghost => Colors.transparent,
    AppButtonVariant.danger => context.colors.errorLight,
  };

  Color _fg(BuildContext context) => switch (variant) {
    AppButtonVariant.primary => AppColors.textOnPrimary,
    AppButtonVariant.secondary => context.colors.textPrimary,
    AppButtonVariant.ghost => AppColors.primary,
    AppButtonVariant.danger => context.colors.errorText,
  };

  BorderSide _border(BuildContext context) => switch (variant) {
    AppButtonVariant.secondary => BorderSide(color: context.colors.border),
    AppButtonVariant.danger => BorderSide(color: context.colors.errorLight),
    _ => BorderSide.none,
  };

  List<BoxShadow> get _shadow => switch (variant) {
    AppButtonVariant.primary when !_disabled => AppShadows.glowPrimary,
    _ => const [],
  };

  EdgeInsets get _padding => switch (size) {
    AppButtonSize.sm => const EdgeInsets.symmetric(
      horizontal: 16,
      vertical: 10,
    ),
    AppButtonSize.md => const EdgeInsets.symmetric(
      horizontal: 24,
      vertical: 14,
    ),
    AppButtonSize.lg => const EdgeInsets.symmetric(
      horizontal: 24,
      vertical: 16,
    ),
  };

  double get _fontSize => switch (size) {
    AppButtonSize.sm => 13,
    AppButtonSize.md => 15,
    AppButtonSize.lg => 16,
  };

  @override
  Widget build(BuildContext context) {
    final bg = _bg(context);
    final fg = _fg(context);
    final border = _border(context);
    return Semantics(
      button: true,
      label: label,
      enabled: !_disabled,
      child: AnimatedOpacity(
        duration: const Duration(milliseconds: 150),
        opacity: _disabled ? 0.55 : 1.0,
        child: PressableScale(
          onTap: _disabled
              ? null
              : () {
                  HapticFeedback.lightImpact();
                  onPressed?.call();
                },
          child: Container(
            width: expand ? double.infinity : null,
            decoration: BoxDecoration(
              color: bg,
              borderRadius: BorderRadius.circular(AppRadius.pill),
              border: Border.fromBorderSide(border),
              boxShadow: _shadow,
            ),
            padding: _padding,
            child: Row(
              mainAxisSize: expand ? MainAxisSize.max : MainAxisSize.min,
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                if (loading)
                  SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      valueColor: AlwaysStoppedAnimation(fg),
                    ),
                  )
                else ...[
                  if (leading != null) ...[leading!, const SizedBox(width: 8)],
                  Flexible(
                    child: Text(
                      label,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      textAlign: TextAlign.center,
                      style: AppTypography.buttonPrimary.copyWith(
                        color: fg,
                        fontSize: _fontSize,
                      ),
                    ),
                  ),
                  if (trailing != null) ...[
                    const SizedBox(width: 8),
                    trailing!,
                  ],
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}
