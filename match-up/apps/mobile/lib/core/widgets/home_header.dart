import 'package:flutter/material.dart';

import '../theme/app_spacing.dart';
import '../theme/app_typography.dart';
import '../theme/dark_colors.dart';
import 'app_tappable.dart';

/// A trailing circular action for [HomeHeader] (filter, calendar, bell, …).
class HomeHeaderAction {
  const HomeHeaderAction({
    required this.icon,
    required this.semanticLabel,
    required this.onTap,
    this.showDot = false,
    this.anchorKey,
  });

  final IconData icon;
  final String semanticLabel;
  final VoidCallback onTap;

  /// Shows the small red unread dot on the top-right of the button.
  final bool showDot;

  /// Optional key applied to this action's tappable container.
  final Key? anchorKey;
}

/// The shared top-level tab header: a large title + subtitle on the left and circular action buttons on the right.
class HomeHeader extends StatelessWidget {
  const HomeHeader({
    super.key,
    required this.title,
    required this.subtitle,
    this.actions = const [],
  });

  final String title;
  final String subtitle;
  final List<HomeHeaderAction> actions;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Padding(
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.x5,
        AppSpacing.x2,
        AppSpacing.x5,
        AppSpacing.x3,
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  title,
                  style: AppTypography.headlineLarge(
                    context,
                  ).copyWith(fontSize: 28, letterSpacing: -0.5),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 2),
                Text(
                  subtitle,
                  style: AppTypography.bodyMedium(
                    context,
                  ).copyWith(color: c.textSecondary),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),
          for (var i = 0; i < actions.length; i++) ...[
            if (i > 0) const SizedBox(width: AppSpacing.x3),
            _HeaderCircle(action: actions[i]),
          ],
        ],
      ),
    );
  }
}

class _HeaderCircle extends StatelessWidget {
  const _HeaderCircle({required this.action});
  final HomeHeaderAction action;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return AppTappable(
      key: action.anchorKey,
      semanticLabel: action.semanticLabel,
      feedback: AppTapFeedback.scale,
      onTap: action.onTap,
      minSize: 44,
      borderRadius: 22,
      child: Container(
        width: 44,
        height: 44,
        decoration: BoxDecoration(
          color: c.surface,
          shape: BoxShape.circle,
          border: Border.all(color: c.border),
          boxShadow: AppShadows.card,
        ),
        alignment: Alignment.center,
        child: Stack(
          clipBehavior: Clip.none,
          alignment: Alignment.center,
          children: [
            Icon(action.icon, size: 22, color: c.textPrimary),
            if (action.showDot)
              Positioned(
                top: -2,
                right: -2,
                child: Container(
                  width: 9,
                  height: 9,
                  decoration: BoxDecoration(
                    color: c.errorText,
                    shape: BoxShape.circle,
                    border: Border.all(color: c.surface, width: 1.5),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}
