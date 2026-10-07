import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:go_router/go_router.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../../core/providers/auth_state_provider.dart';
import '../../../core/providers/repository_providers.dart';
import '../../../core/storage/route_store.dart';
import '../../../core/storage/secure_token_store.dart';
import '../../notifications/services/push_notification_service.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/widgets/home_indicator.dart';

class SplashScreen extends ConsumerStatefulWidget {
  const SplashScreen({super.key});

  @override
  ConsumerState<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends ConsumerState<SplashScreen>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;

  @override
  void initState() {
    super.initState();
    SystemChrome.setSystemUIOverlayStyle(
      const SystemUiOverlayStyle(
        statusBarColor: Colors.transparent,
        statusBarIconBrightness: Brightness.light,
        statusBarBrightness: Brightness.dark,
      ),
    );
    // 2200ms is well beyond AppDurations.emphasized (320ms).
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 2200),
    )..forward();

    // Route as soon as the session check finishes, with only a short minimum dwell (800ms) for the brand moment.
    Future.wait([
          ref.read(authStateProvider.notifier).checkSession(),
          Future.delayed(const Duration(milliseconds: 800)),
        ])
        .timeout(const Duration(seconds: 8))
        .then((_) {
          if (!mounted) return;
          _routeBySession();
        })
        .catchError((_) {
          // Session check failed or hung (a never-completing secure-storage read pins `Future.wait` forever.
          if (!mounted) return;
          context.go('/onboarding');
        });
  }

  Future<void> _routeBySession() async {
    if (!mounted) return;
    final status = ref.read(authStatusProvider);
    if (status == AuthStatus.authenticated) {
      // Session survived (cold start logged-in): make sure this device is registered for push.
      unawaited(
        PushNotificationService.instance.refreshRegistration(
          deviceRepository: ref.read(deviceRepositoryProvider),
        ),
      );
      // New accounts must finish onboarding: gtk_done_<uid>==false resumes GTK.
      bool? gtkDone;
      try {
        final uid =
            ref.read(authStateProvider).userId ??
            await SecureTokenStore.instance.readUserId() ??
            '';
        if (uid.isEmpty) {
          gtkDone = null;
        } else {
          final prefs = await SharedPreferences.getInstance();
          gtkDone = prefs.getBool(gtkDoneKeyFor(uid));
        }
      } catch (_) {
        gtkDone = null;
      }
      if (!mounted) return;
      if (gtkDone == false) {
        context.go('/get-to-know-1');
        return;
      }
      // Restore the last visited route so the user continues where they left off after minimize or OS kill.
      final lastRoute = await RouteStore.instance.read();
      if (!mounted) return;
      context.go(lastRoute ?? '/discovery');
    } else {
      // On logout or first run, clear any stale stored route so the next login always starts fresh at /discovery.
      await RouteStore.instance.clear();
      if (!mounted) return;
      context.go('/onboarding');
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    // Deliberate deviation from the shared auth-shell pattern (PRD 2.1 principle 1): the splash screen is a full-bleed.
    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [AppColors.splashTop, AppColors.splashBottom],
          ),
        ),
        child: Stack(
          fit: StackFit.expand,
          children: [
            // Decorative SVG dots positioned per Figma (inset % of 390x844)
            const Positioned(
              left: -40,
              top: 120,
              child: _DecorationSvg('assets/images/splash/dot_1.svg', 220),
            ),
            Positioned(
              right: -50,
              top: -40,
              child: _DecorationSvg('assets/images/splash/dot_2.svg', 180),
            ),
            const Positioned(
              left: -50,
              bottom: 120,
              child: _DecorationSvg('assets/images/splash/dot_3.svg', 160),
            ),
            const Positioned(
              right: -40,
              bottom: 80,
              child: _DecorationSvg('assets/images/splash/dot_4.svg', 140),
            ),

            SafeArea(
              child: Column(
                children: [
                  Expanded(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        // Logo badge (96px, rounded 24, soft drop shadow)
                        Container(
                          width: 96,
                          height: 96,
                          decoration: BoxDecoration(
                            borderRadius: BorderRadius.circular(AppRadius.xl),
                            boxShadow: AppShadows.floating,
                          ),
                          child: ClipRRect(
                            borderRadius: BorderRadius.circular(AppRadius.xl),
                            child: Image.asset(
                              'assets/images/splash/logo-badge.png',
                              fit: BoxFit.cover,
                              semanticLabel: 'MatchUp logo',
                              errorBuilder: (_, _, _) => const Icon(
                                Icons.sports_soccer_rounded,
                                size: 48,
                                color: Colors.white,
                              ),
                            ),
                          ),
                        ),
                        const SizedBox(height: 16),
                        Text('MatchUp', style: AppTypography.wordmarkSplash),
                        const SizedBox(height: 10),
                        Text(
                          'Find Your Game. Meet Your Team.',
                          style: AppTypography.bodyOnboarding.copyWith(
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ],
                    ),
                  ),
                  // Progress bar loader.
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 90),
                    child: AnimatedBuilder(
                      animation: _controller,
                      builder: (_, _) {
                        return Container(
                          width: double.infinity,
                          height: 3,
                          decoration: BoxDecoration(
                            color: AppColors.textOnPrimary.withValues(
                              alpha: 0.25,
                            ),
                            borderRadius: AppRadius.pillR,
                          ),
                          child: FractionallySizedBox(
                            alignment: Alignment.centerLeft,
                            widthFactor: _controller.value,
                            child: Container(
                              decoration: BoxDecoration(
                                color: AppColors.primary,
                                borderRadius: AppRadius.pillR,
                              ),
                            ),
                          ),
                        );
                      },
                    ),
                  ),
                  const SizedBox(height: 32),
                  const HomeIndicator(color: AppColors.textOnPrimary),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _DecorationSvg extends StatelessWidget {
  const _DecorationSvg(this.path, this.size);
  final String path;
  final double size;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: size,
      height: size,
      // flutter_svg 2.x has no errorBuilder — placeholderBuilder covers decode failures.
      child: SvgPicture.asset(
        path,
        fit: BoxFit.contain,
        placeholderBuilder: (_) => const SizedBox.shrink(),
      ),
    );
  }
}
