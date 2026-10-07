import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../core/constants/app_constants.dart';
import '../core/providers/repository_providers.dart';
import '../core/theme/app_colors.dart';
import '../core/theme/app_spacing.dart';
import '../core/theme/app_typography.dart';
import '../core/theme/dark_colors.dart';
import '../core/theme/theme_controller.dart';
import '../core/widgets/app_snackbar.dart';
import '../features/activities/presentation/my_activities_screen.dart';
import '../features/notifications/services/push_notification_service.dart';
import '../features/notifications/services/push_routing.dart';
import 'router.dart';

/// Cached GoRouter instance. Using a provider ensures the router is constructed once and the refreshListenable can.
final _routerProvider = Provider<GoRouter>(buildRouter);

class MatchUpApp extends ConsumerWidget {
  const MatchUpApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final mode = ref.watch(themeModeProvider);
    // GoRouter is instantiated once and cached in a provider so it isn't recreated on every rebuild of MatchUpApp.
    final router = ref.watch(_routerProvider);
    return MaterialApp.router(
      title: AppConstants.appName,
      debugShowCheckedModeBanner: false,
      theme: _buildLightTheme(),
      darkTheme: _buildDarkTheme(),
      themeMode: mode,
      routerConfig: router,
      builder: (context, child) {
        // Routes notification taps / foreground banners (see PushNotificationService streams) into the navigator.
        final routedChild = _PushRouter(
          child: child ?? const SizedBox.shrink(),
        );
        // Match Figma / CSS line-height semantics: leadingDistribution.even splits the extra leading equally above.
        return DefaultTextHeightBehavior(
          textHeightBehavior: const TextHeightBehavior(
            applyHeightToFirstAscent: false,
            applyHeightToLastDescent: false,
            leadingDistribution: TextLeadingDistribution.even,
          ),
          child: routedChild,
        );
      },
    );
  }

  ThemeData _buildLightTheme() {
    const colorScheme = ColorScheme.light(
      primary: AppColors.primary,
      onPrimary: AppColors.textOnPrimary,
      primaryContainer: AppColors.primaryLight,
      onPrimaryContainer: AppColors.primary,
      secondary: AppColors.accent,
      onSecondary: AppColors.textOnPrimary,
      secondaryContainer: AppColors.accentLight,
      onSecondaryContainer: AppColors.accent,
      surface: AppColors.surface,
      onSurface: AppColors.textPrimary,
      surfaceContainerHighest: AppColors.surfaceContainerHighest,
      onSurfaceVariant: AppColors.textSecondary,
      error: AppColors.error,
      onError: AppColors.textOnPrimary,
      outline: AppColors.border,
      shadow: AppColors.shadow,
    );

    return ThemeData(
      useMaterial3: true,
      brightness: Brightness.light,
      colorScheme: colorScheme,
      fontFamily: AppTypography.fontFamily,
      scaffoldBackgroundColor: AppColors.background,
      appBarTheme: AppBarTheme(
        backgroundColor: AppColors.background,
        elevation: 0,
        centerTitle: true,
        iconTheme: const IconThemeData(color: AppColors.textPrimary),
        titleTextStyle: const TextStyle(
          fontFamily: AppTypography.fontFamily,
          fontSize: 18,
          fontWeight: FontWeight.w600,
          letterSpacing: -0.36,
          height: AppTypography.uiLineHeight,
          color: AppColors.textPrimary,
        ),
      ),
      bottomNavigationBarTheme: const BottomNavigationBarThemeData(
        backgroundColor: AppColors.surface,
        selectedItemColor: AppColors.primary,
        // textSecondary (4.76:1), not textTertiary (2.54:1).
        unselectedItemColor: AppColors.textSecondary,
        type: BottomNavigationBarType.fixed,
        elevation: 8,
      ),
      navigationBarTheme: NavigationBarThemeData(
        backgroundColor: AppColors.surface,
        indicatorColor: AppColors.primaryLight,
        iconTheme: WidgetStateProperty.resolveWith((states) {
          if (states.contains(WidgetState.selected)) {
            return const IconThemeData(color: AppColors.primary);
          }
          return const IconThemeData(color: AppColors.textSecondary);
        }),
        labelTextStyle: WidgetStateProperty.resolveWith((states) {
          if (states.contains(WidgetState.selected)) {
            return _captionStyle.copyWith(color: AppColors.primary);
          }
          return _captionStyle.copyWith(color: AppColors.textSecondary);
        }),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: AppColors.surfaceSubtle,
        contentPadding: const EdgeInsets.symmetric(
          horizontal: 20,
          vertical: 14,
        ),
        border: OutlineInputBorder(
          borderRadius: AppRadius.pillR,
          borderSide: const BorderSide(color: AppColors.border),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: AppRadius.pillR,
          borderSide: const BorderSide(color: AppColors.border),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: AppRadius.pillR,
          borderSide: const BorderSide(color: AppColors.primary, width: 1.5),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: AppRadius.pillR,
          borderSide: const BorderSide(color: AppColors.error),
        ),
        focusedErrorBorder: OutlineInputBorder(
          borderRadius: AppRadius.pillR,
          borderSide: const BorderSide(color: AppColors.error, width: 1.5),
        ),
        hintStyle: _bodyReadingStyle.copyWith(color: AppColors.textTertiary),
        floatingLabelBehavior: FloatingLabelBehavior.never,
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: AppColors.primary,
          foregroundColor: AppColors.textOnPrimary,
          padding: const EdgeInsets.symmetric(vertical: 16),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppRadius.card),
          ),
          textStyle: AppTypography.button,
        ),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          backgroundColor: AppColors.primary,
          foregroundColor: AppColors.textOnPrimary,
          padding: const EdgeInsets.symmetric(vertical: 16),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppRadius.card),
          ),
          textStyle: AppTypography.button,
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: AppColors.textPrimary,
          padding: const EdgeInsets.symmetric(vertical: 16),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppRadius.card),
          ),
          side: const BorderSide(color: AppColors.border),
          textStyle: AppTypography.button,
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          foregroundColor: AppColors.primary,
          textStyle: AppTypography.button.copyWith(fontSize: 14),
        ),
      ),
      cardTheme: const CardThemeData(
        color: AppColors.card,
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.all(Radius.circular(AppRadius.card)),
        ),
      ),
      chipTheme: ChipThemeData(
        backgroundColor: AppColors.background,
        selectedColor: AppColors.primaryLight,
        labelStyle: _bodyMediumStyle.copyWith(color: AppColors.textSecondary),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppRadius.lg),
        ),
        side: const BorderSide(color: AppColors.border),
      ),
      extensions: const [AppColorTokens.light],
    );
  }

  // Context free style helpers.
  // `AppTypography`'s styles are theme-aware and require a `BuildContext` (see its doc comment).
  static const TextStyle _captionStyle = TextStyle(
    fontFamily: AppTypography.fontFamily,
    fontSize: 12,
    fontWeight: FontWeight.w500,
    height: AppTypography.uiLineHeight,
  );

  static const TextStyle _bodyReadingStyle = TextStyle(
    fontFamily: AppTypography.fontFamily,
    fontSize: 14,
    fontWeight: FontWeight.normal,
    height: AppTypography.readingLineHeight,
  );

  static const TextStyle _bodyMediumStyle = TextStyle(
    fontFamily: AppTypography.fontFamily,
    fontSize: 14,
    fontWeight: FontWeight.normal,
    height: AppTypography.uiLineHeight,
  );

  ThemeData _buildDarkTheme() {
    const colorScheme = ColorScheme.dark(
      primary: AppColors.primary,
      onPrimary: AppColors.textOnPrimary,
      primaryContainer: DarkPalette.primaryContainer,
      onPrimaryContainer: AppColors.primaryLight,
      secondary: AppColors.accent,
      onSecondary: AppColors.textOnPrimary,
      secondaryContainer: DarkPalette.secondaryContainer,
      onSecondaryContainer: AppColors.accentLight,
      surface: DarkPalette.surface,
      onSurface: DarkPalette.textPrimary,
      surfaceContainerHighest: DarkPalette.card,
      onSurfaceVariant: DarkPalette.textSecondary,
      error: AppColors.error,
      onError: AppColors.textOnPrimary,
      outline: DarkPalette.border,
      shadow: DarkPalette.shadow,
    );

    return ThemeData(
      useMaterial3: true,
      brightness: Brightness.dark,
      colorScheme: colorScheme,
      fontFamily: AppTypography.fontFamily,
      scaffoldBackgroundColor: DarkPalette.background,
      appBarTheme: AppBarTheme(
        backgroundColor: DarkPalette.background,
        elevation: 0,
        centerTitle: true,
        iconTheme: const IconThemeData(color: DarkPalette.textPrimary),
        titleTextStyle: const TextStyle(
          fontFamily: AppTypography.fontFamily,
          fontSize: 18,
          fontWeight: FontWeight.w600,
          letterSpacing: -0.36,
          height: AppTypography.uiLineHeight,
          color: DarkPalette.textPrimary,
        ),
      ),
      bottomNavigationBarTheme: const BottomNavigationBarThemeData(
        backgroundColor: DarkPalette.surface,
        // primaryOnDark, not brand primary: #0B1F8A on a dark surface is 1.3:1 (invisible).
        selectedItemColor: DarkPalette.primaryOnDark,
        unselectedItemColor: DarkPalette.textSecondary,
        type: BottomNavigationBarType.fixed,
        elevation: 8,
      ),
      navigationBarTheme: NavigationBarThemeData(
        backgroundColor: DarkPalette.surface,
        indicatorColor: DarkPalette.primaryContainer,
        iconTheme: WidgetStateProperty.resolveWith((states) {
          if (states.contains(WidgetState.selected)) {
            return const IconThemeData(color: DarkPalette.primaryOnDark);
          }
          return const IconThemeData(color: DarkPalette.textSecondary);
        }),
        labelTextStyle: WidgetStateProperty.resolveWith((states) {
          if (states.contains(WidgetState.selected)) {
            return _captionStyle.copyWith(color: DarkPalette.primaryOnDark);
          }
          return _captionStyle.copyWith(color: DarkPalette.textSecondary);
        }),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: DarkPalette.card,
        contentPadding: const EdgeInsets.symmetric(
          horizontal: 20,
          vertical: 14,
        ),
        border: OutlineInputBorder(
          borderRadius: AppRadius.pillR,
          borderSide: const BorderSide(color: DarkPalette.border),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: AppRadius.pillR,
          borderSide: const BorderSide(color: DarkPalette.border),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: AppRadius.pillR,
          borderSide: const BorderSide(color: AppColors.primary, width: 1.5),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: AppRadius.pillR,
          borderSide: const BorderSide(color: AppColors.error),
        ),
        focusedErrorBorder: OutlineInputBorder(
          borderRadius: AppRadius.pillR,
          borderSide: const BorderSide(color: AppColors.error, width: 1.5),
        ),
        floatingLabelBehavior: FloatingLabelBehavior.never,
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: AppColors.primary,
          foregroundColor: AppColors.textOnPrimary,
          padding: const EdgeInsets.symmetric(vertical: 16),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppRadius.card),
          ),
          textStyle: AppTypography.button,
        ),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          backgroundColor: AppColors.primary,
          foregroundColor: AppColors.textOnPrimary,
          padding: const EdgeInsets.symmetric(vertical: 16),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppRadius.card),
          ),
          textStyle: AppTypography.button,
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: DarkPalette.textPrimary,
          padding: const EdgeInsets.symmetric(vertical: 16),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppRadius.card),
          ),
          side: const BorderSide(color: DarkPalette.border),
          textStyle: AppTypography.button,
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          // Lightened brand blue: raw primary (#0B1F8A) as text on a dark background is 1.4:1.
          foregroundColor: DarkPalette.primaryOnDark,
          textStyle: AppTypography.button.copyWith(fontSize: 14),
        ),
      ),
      cardTheme: const CardThemeData(
        color: DarkPalette.card,
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.all(Radius.circular(AppRadius.card)),
        ),
      ),
      chipTheme: ChipThemeData(
        backgroundColor: DarkPalette.card,
        selectedColor: DarkPalette.primaryContainer,
        labelStyle: _bodyMediumStyle.copyWith(color: DarkPalette.textPrimary),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppRadius.lg),
        ),
        side: const BorderSide(color: DarkPalette.border),
      ),
      extensions: const [AppColorTokens.dark],
    );
  }
}

// Push routing.

/// Subscribes to [PushNotificationService] streams and turns them into navigation + foreground snackbars:
/// System-tray taps (background/killed) → deep-link via [routeForPush].
/// Context comes from [rootNavigatorKey] so this works without being under any particular screen.
class _PushRouter extends ConsumerStatefulWidget {
  const _PushRouter({required this.child});
  final Widget child;

  @override
  ConsumerState<_PushRouter> createState() => _PushRouterState();
}

class _PushRouterState extends ConsumerState<_PushRouter> {
  StreamSubscription<PushPayload>? _openedSub;
  StreamSubscription<PushPayload>? _foregroundSub;

  @override
  void initState() {
    super.initState();
    _openedSub = PushNotificationService.onNotificationOpened.listen(_open);
    _foregroundSub = PushNotificationService.onForegroundMessage.listen(
      _banner,
    );
  }

  @override
  void dispose() {
    _openedSub?.cancel();
    _foregroundSub?.cancel();
    super.dispose();
  }

  void _open(PushPayload payload) {
    final route = routeForPush(payload);
    if (route == null || !mounted) return;
    // Membership may have changed underneath the cached tabs.
    _refreshMyGames(payload);
    // Defer a frame so taps arriving mid-transition don't race the navigator.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      final ctx = rootNavigatorKey.currentContext;
      if (ctx == null) return;
      // push (not go): the tap lands on top of the current stack so back returns to where the user was.
      GoRouter.of(ctx).push(route);
    });
  }

  void _banner(PushPayload payload) async {
    if (!mounted) return;
    // Same membership refresh as the tray-tap path: the user may be sitting on Upcoming right now watching the stale.
    _refreshMyGames(payload);
    // Locally muted group chats never banner while foregrounded.
    final muted = await _isMutedChat(payload);
    if (muted || !mounted) return;
    final ctx = rootNavigatorKey.currentContext;
    if (ctx == null || !ctx.mounted) return;
    final route = routeForPush(payload);
    AppSnackbar.show(
      ctx,
      message: payload.title ?? 'New notification',
      variant: AppSnackbarVariant.info,
      actionLabel: route == null ? null : 'View',
      onAction: route == null
          ? null
          : () {
              final c = rootNavigatorKey.currentContext;
              if (c != null && c.mounted) GoRouter.of(c).go(route);
            },
    );
  }

  /// Invalidates the My Games tab providers when [payload] can have changed membership.
  void _refreshMyGames(PushPayload payload) {
    if (!invalidatesMyGames(payload)) return;
    // Bust the feed cache too: tab refetches would otherwise serve cached rows.
    ref.read(activityRepositoryProvider).invalidateFeed();
    ref.invalidate(joinedGamesProvider);
    ref.invalidate(hostedGamesProvider);
    ref.invalidate(pastGamesProvider);
    ref.invalidate(pendingGamesProvider);
  }

  /// True when [payload] targets a locally muted group chat. Mute is keyed by activity id.
  Future<bool> _isMutedChat(PushPayload payload) async {
    final id = payload.activityId;
    if (id == null || payload.type != 'chat_message') return false;
    try {
      final prefs = await SharedPreferences.getInstance();
      return prefs.getStringList(mutedChatsKey)?.contains(id) ?? false;
    } catch (_) {
      return false;
    }
  }

  @override
  Widget build(BuildContext context) => widget.child;
}
