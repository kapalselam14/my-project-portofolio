import 'package:flutter/material.dart';

import '../theme/app_spacing.dart';
import '../theme/app_typography.dart';
import '../theme/dark_colors.dart';
import 'app_tappable.dart';

enum AppSnackbarVariant { success, error, info, warning }

/// Consistent snackbar/toast for MatchUp.
/// dart AppSnackbar.show(context, message: 'Activity created!').
class AppSnackbar {
  AppSnackbar._();

  static void show(
    BuildContext context, {
    required String message,
    AppSnackbarVariant variant = AppSnackbarVariant.info,
    Duration duration = const Duration(seconds: 3),
    String? actionLabel,
    VoidCallback? onAction,
  }) {
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(
        SnackBar(
          content: _AppSnackbarContent(
            message: message,
            variant: variant,
            actionLabel: actionLabel,
            onAction: onAction,
          ),
          backgroundColor: Colors.transparent,
          elevation: 0,
          duration: duration,
          behavior: SnackBarBehavior.floating,
          margin: const EdgeInsets.fromLTRB(16, 0, 16, 24),
        ),
      );
  }
}

class _AppSnackbarContent extends StatelessWidget {
  const _AppSnackbarContent({
    required this.message,
    required this.variant,
    this.actionLabel,
    this.onAction,
  });

  final String message;
  final AppSnackbarVariant variant;
  final String? actionLabel;
  final VoidCallback? onAction;

  Color _bg(BuildContext context) => switch (variant) {
    AppSnackbarVariant.success => context.colors.statusSuccessBg,
    AppSnackbarVariant.error => context.colors.errorLight,
    AppSnackbarVariant.warning => context.colors.warningBg,
    AppSnackbarVariant.info => context.colors.primarySoft,
  };

  Color _fg(BuildContext context) => switch (variant) {
    AppSnackbarVariant.success => context.colors.successText,
    AppSnackbarVariant.error => context.colors.errorText,
    AppSnackbarVariant.warning => context.colors.warningText,
    AppSnackbarVariant.info => context.colors.primaryOnSurface,
  };

  IconData get _icon => switch (variant) {
    AppSnackbarVariant.success => Icons.check_circle_outline_rounded,
    AppSnackbarVariant.error => Icons.error_outline_rounded,
    AppSnackbarVariant.warning => Icons.warning_amber_rounded,
    AppSnackbarVariant.info => Icons.info_outline_rounded,
  };

  @override
  Widget build(BuildContext context) {
    final bg = _bg(context);
    final fg = _fg(context);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(AppRadius.md),
        border: Border.all(color: fg.withValues(alpha: 0.25)),
        boxShadow: AppShadows.floating,
      ),
      child: Row(
        children: [
          Icon(_icon, color: fg, size: 20),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              message,
              style: AppTypography.bodyMedium(
                context,
              ).copyWith(color: fg, fontWeight: FontWeight.w600, fontSize: 14),
            ),
          ),
          if (actionLabel != null && onAction != null)
            AppTappable(
              onTap: onAction,
              semanticLabel: actionLabel!,
              feedback: AppTapFeedback.scale,
              child: Text(
                actionLabel!,
                style: AppTypography.bodyMedium(context).copyWith(
                  color: fg,
                  fontWeight: FontWeight.w800,
                  fontSize: 13,
                ),
              ),
            ),
        ],
      ),
    );
  }
}
