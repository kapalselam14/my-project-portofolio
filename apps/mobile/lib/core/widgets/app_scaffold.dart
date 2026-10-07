import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../theme/app_spacing.dart';
import '../theme/app_typography.dart';
import '../theme/dark_colors.dart';
import 'home_indicator.dart';
import 'pressable_scale.dart';

/// The three header shapes every screen in the app needs.
enum _HeaderVariant {
  /// Big left-aligned title, optional trailing actions.
  primary,

  /// Back button + centred title + optional single trailing action.
  detail,

  /// Back/close + centred title + optional trailing *text* action ("Save", "Done").
  sheet,

  /// No header at all — the screen supplies its own top content.
  none,
}

/// Standard scaffold for MatchUp screens — the mandatory screen shell.
/// Every screen should reach for one of the three named constructors instead of composing a raw [Scaffold]:
/// ```dart AppScaffold.primary( title: 'My Activities', actions: [NotificationIconButton(onTap: ...)], body: ..., ).
/// AppScaffold.detail( title: 'Manage Activity', body: ..., ).
/// AppScaffold.sheet( title: 'Edit Profile', trailingAction: 'Save', onTrailingAction: _save, body: ..., ) ```.
/// Handles safe area, background color, and an optional pinned bottom bar.
class AppScaffold extends StatelessWidget {
  const AppScaffold({
    super.key,
    required this.body,
    this.title,
    this.actions,
    this.leading,
    this.bottomBar,
    this.backgroundColor,
    this.resizeToAvoidBottomInset = true,
    this.safeAreaTop = true,
    this.showHomeIndicator = true,
    this.headerPadding = const EdgeInsets.fromLTRB(
      AppSpacing.x6,
      AppSpacing.x2,
      AppSpacing.x6,
      AppSpacing.x2,
    ),
  }) : _variant = _HeaderVariant.none,
       trailingAction = null,
       onTrailingAction = null,
       trailingActionEnabled = true,
       onBack = null;

  /// Big left-aligned title. Top-level tab screens.
  const AppScaffold.primary({
    super.key,
    required this.body,
    required this.title,
    this.actions,
    this.bottomBar,
    this.backgroundColor,
    this.resizeToAvoidBottomInset = true,
    this.safeAreaTop = true,
    this.showHomeIndicator = true,
    this.headerPadding = const EdgeInsets.fromLTRB(
      AppSpacing.x6,
      AppSpacing.x2,
      AppSpacing.x6,
      AppSpacing.x2,
    ),
  }) : _variant = _HeaderVariant.primary,
       leading = null,
       trailingAction = null,
       onTrailingAction = null,
       trailingActionEnabled = true,
       onBack = null;

  /// Back button + centred title. Pushed screens.
  const AppScaffold.detail({
    super.key,
    required this.body,
    required this.title,
    this.actions,
    this.onBack,
    this.bottomBar,
    this.backgroundColor,
    this.resizeToAvoidBottomInset = true,
    this.safeAreaTop = true,
    this.showHomeIndicator = true,
    this.headerPadding = const EdgeInsets.fromLTRB(
      AppSpacing.x4,
      AppSpacing.x1,
      AppSpacing.x4,
      AppSpacing.x1,
    ),
  }) : _variant = _HeaderVariant.detail,
       leading = null,
       trailingAction = null,
       onTrailingAction = null,
       trailingActionEnabled = true;

  /// Back/close + centred title + optional trailing text action.
  const AppScaffold.sheet({
    super.key,
    required this.body,
    required this.title,
    this.trailingAction,
    this.onTrailingAction,
    this.trailingActionEnabled = true,
    this.onBack,
    this.bottomBar,
    this.backgroundColor,
    this.resizeToAvoidBottomInset = true,
    this.safeAreaTop = true,
    this.showHomeIndicator = true,
    this.headerPadding = const EdgeInsets.fromLTRB(
      AppSpacing.x4,
      AppSpacing.x1,
      AppSpacing.x4,
      AppSpacing.x1,
    ),
  }) : _variant = _HeaderVariant.sheet,
       leading = null,
       actions = null;

  final _HeaderVariant _variant;

  final Widget body;
  final String? title;

  /// `.primary()` only — trailing icon actions (bell, filter, …).
  final List<Widget>? actions;

  /// Plain constructor only — fully custom leading slot.
  final Widget? leading;

  /// `.detail()` / `.sheet()` — override the default `Navigator.maybePop()`.
  final VoidCallback? onBack;

  /// `.sheet()` only — trailing text action, e.g. "Save".
  final String? trailingAction;
  final VoidCallback? onTrailingAction;
  final bool trailingActionEnabled;

  final Widget? bottomBar;
  final Color? backgroundColor;
  final bool resizeToAvoidBottomInset;
  final bool safeAreaTop;

  /// Screens hoisted outside `ShellRoute` (no bottom nav) should draw their own home indicator here.
  final bool showHomeIndicator;
  final EdgeInsetsGeometry headerPadding;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: backgroundColor ?? context.colors.background,
      resizeToAvoidBottomInset: resizeToAvoidBottomInset,
      body: SafeArea(
        top: safeAreaTop,
        bottom: false,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _buildHeader(context),
            Expanded(child: body),
            ?bottomBar,
            if (showHomeIndicator) const HomeIndicator(),
          ],
        ),
      ),
    );
  }

  Widget _buildHeader(BuildContext context) {
    switch (_variant) {
      case _HeaderVariant.none:
        if (title == null) return const SizedBox.shrink();
        return AppScreenHeader(
          title: title!,
          leading: leading,
          actions: actions,
          padding: headerPadding,
        );

      case _HeaderVariant.primary:
        return Container(
          color: context.colors.surface,
          padding: headerPadding,
          child: Row(
            children: [
              Expanded(
                child: Text(
                  title!,
                  style: AppTypography.headlineLarge(context),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              if (actions != null)
                Row(mainAxisSize: MainAxisSize.min, children: actions!),
            ],
          ),
        );

      case _HeaderVariant.detail:
        return Padding(
          padding: headerPadding,
          child: Row(
            children: [
              AppBackButton(onPressed: onBack),
              Expanded(
                child: Center(
                  child: Text(
                    title!,
                    style: AppTypography.labelField(
                      context,
                    ).copyWith(fontSize: 16, fontWeight: FontWeight.w800),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ),
              // Mirrors the back button's 44px width so the title stays centred against the *content* area.
              if (actions != null && actions!.isNotEmpty)
                Row(mainAxisSize: MainAxisSize.min, children: actions!)
              else
                const SizedBox(width: 44),
            ],
          ),
        );

      case _HeaderVariant.sheet:
        return Padding(
          padding: headerPadding,
          child: Row(
            children: [
              AppBackButton(onPressed: onBack),
              Expanded(
                child: Center(
                  child: Text(
                    title!,
                    style: AppTypography.titleSheet(context),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ),
              SizedBox(
                width: 44,
                height: 44,
                child: trailingAction == null
                    ? null
                    : Center(
                        child: Semantics(
                          button: true,
                          label: trailingAction,
                          enabled: trailingActionEnabled,
                          child: PressableScale(
                            onTap: trailingActionEnabled
                                ? onTrailingAction
                                : null,
                            child: Text(
                              trailingAction!,
                              style: AppTypography.labelField(context).copyWith(
                                color: trailingActionEnabled
                                    ? context.colors.primaryOnSurface
                                    : context.colors.textTertiary,
                              ),
                            ),
                          ),
                        ),
                      ),
              ),
            ],
          ),
        );
    }
  }
}

/// Consistent screen header: back/leading slot + title + actions.
class AppScreenHeader extends StatelessWidget {
  const AppScreenHeader({
    super.key,
    required this.title,
    this.leading,
    this.actions,
    this.padding = const EdgeInsets.fromLTRB(
      AppSpacing.x5,
      AppSpacing.x3,
      AppSpacing.x5,
      AppSpacing.x2,
    ),
    this.style,
  });

  final String title;
  final Widget? leading;
  final List<Widget>? actions;
  final EdgeInsetsGeometry padding;
  final TextStyle? style;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: padding,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          if (leading != null) ...[leading!, const SizedBox(width: 8)],
          Expanded(
            child: Text(
              title,
              style: style ?? AppTypography.titleScreen(context),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ),
          if (actions != null)
            Row(mainAxisSize: MainAxisSize.min, children: actions!),
        ],
      ),
    );
  }
}

/// Standard back button aligned with [AppScreenHeader] and used by [AppScaffold]'s `.detail()` / `.sheet()` headers.
class AppBackButton extends StatelessWidget {
  const AppBackButton({super.key, this.onPressed, this.color});

  final VoidCallback? onPressed;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: 'Back',
      child: PressableScale(
        onTap: () {
          HapticFeedback.lightImpact();
          if (onPressed != null) {
            onPressed!();
          } else {
            Navigator.of(context).maybePop();
          }
        },
        child: SizedBox(
          width: 44,
          height: 44,
          child: Center(
            child: Container(
              width: 36,
              height: 36,
              decoration: BoxDecoration(
                color: context.colors.surfaceSubtle,
                borderRadius: BorderRadius.circular(AppRadius.pill),
                border: Border.all(color: context.colors.border),
              ),
              child: Icon(
                Icons.arrow_back_ios_new_rounded,
                size: 16,
                color: color ?? context.colors.textPrimary,
              ),
            ),
          ),
        ),
      ),
    );
  }
}
