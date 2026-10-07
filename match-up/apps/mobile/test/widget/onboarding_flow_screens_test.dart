import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

import 'package:matchup_mobile/features/auth/presentation/onboarding_screen.dart';
import 'package:matchup_mobile/features/auth/presentation/splash_screen.dart';
import 'package:matchup_mobile/features/auth/presentation/welcome_screen.dart';

Future<void> _pumpRouter(
  WidgetTester tester, {
  required String initialLocation,
  required List<GoRoute> routes,
}) async {
  final router = GoRouter(initialLocation: initialLocation, routes: routes);
  await tester.pumpWidget(
    ProviderScope(child: MaterialApp.router(routerConfig: router)),
  );
}

void main() {
  group('SplashScreen', () {
    testWidgets('should render the wordmark and tagline', (tester) async {
      await _pumpRouter(
        tester,
        initialLocation: '/splash',
        routes: [
          GoRoute(path: '/splash', builder: (_, _) => const SplashScreen()),
          GoRoute(
            path: '/onboarding',
            builder: (_, _) => const Scaffold(body: Text('Onboarding')),
          ),
          GoRoute(
            path: '/discovery',
            builder: (_, _) => const Scaffold(body: Text('Discovery')),
          ),
        ],
      );
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 100));

      expect(find.text('MatchUp'), findsOneWidget);
      expect(find.text('Find Your Game. Meet Your Team.'), findsOneWidget);

      // Drain the splash screen's pending timers — the 800ms minimum
      // dwell plus the 8s wall-clock session-check timeout — so the
      // test binding doesn't fail on a leftover Timer at teardown
      // (pumpAndSettle throws with a pending timer). The secure-storage
      // read has no platform channel in the test environment and fails
      // gracefully to unauthenticated, redirecting to /onboarding —
      // that redirect isn't part of what this test asserts.
      await tester.pump(const Duration(seconds: 9));
      await tester.pumpAndSettle();
    });
  });

  group('OnboardingScreen', () {
    testWidgets('should render the first page heading and page dots', (
      tester,
    ) async {
      await _pumpRouter(
        tester,
        initialLocation: '/onboarding',
        routes: [
          GoRoute(
            path: '/onboarding',
            builder: (_, _) => const OnboardingScreen(),
          ),
          GoRoute(
            path: '/welcome',
            builder: (_, _) => const Scaffold(body: Text('Welcome')),
          ),
          GoRoute(
            path: '/login',
            builder: (_, _) => const Scaffold(body: Text('Login')),
          ),
        ],
      );
      await tester.pumpAndSettle();

      expect(find.text('Discover Sports Activities Near You'), findsOneWidget);
      expect(find.text('Next'), findsOneWidget);
    });

    testWidgets(
      'should navigate to get-to-know-1 after tapping through all pages',
      (tester) async {
        await _pumpRouter(
          tester,
          initialLocation: '/onboarding',
          routes: [
            GoRoute(
              path: '/onboarding',
              builder: (_, _) => const OnboardingScreen(),
            ),
            GoRoute(
              path: '/get-to-know-1',
              builder: (_, _) => const Scaffold(body: Text('Get To Know 1')),
            ),
            GoRoute(
              path: '/welcome',
              builder: (_, _) => const Scaffold(body: Text('Welcome')),
            ),
            GoRoute(
              path: '/login',
              builder: (_, _) => const Scaffold(body: Text('Login')),
            ),
          ],
        );
        await tester.pumpAndSettle();

        // Page 1 -> 2
        await tester.tap(find.text('Next'));
        await tester.pumpAndSettle();
        expect(find.text('Swipe to Match With Activities'), findsOneWidget);

        // Page 2 -> 3
        await tester.tap(find.text('Next'));
        await tester.pumpAndSettle();
        expect(find.text('Join, Chat, and Play Together'), findsOneWidget);
        expect(find.text('Get Started'), findsOneWidget);

        // Page 3 -> get-to-know-1 (post-signup flow sits outside the shell;
        // see lib/app/router.dart — onboarding no longer goes to /welcome).
        await tester.tap(find.text('Get Started'));
        await tester.pumpAndSettle();
        expect(find.text('Get To Know 1'), findsOneWidget);
      },
    );
  });

  group('WelcomeScreen', () {
    testWidgets('should render heading and CTAs, and navigate to register', (
      tester,
    ) async {
      // WelcomeScreen lays out at real-phone proportions (collage + heading +
      // Spacer + CTAs); the default 800x600 test canvas is shorter than a
      // phone and overflows vertically. setSurfaceSize alone doesn't change
      // MediaQuery.size on this Flutter version (see
      // spotlight_overlay_test.dart), so resize the test view itself —
      // otherwise the collage Row (sized from MediaQuery width) overflows
      // the narrower surface.
      tester.view.physicalSize = const Size(600, 1000);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.reset);

      await _pumpRouter(
        tester,
        initialLocation: '/welcome',
        routes: [
          GoRoute(path: '/welcome', builder: (_, _) => const WelcomeScreen()),
          GoRoute(
            path: '/register',
            builder: (_, _) => const Scaffold(body: Text('Register')),
          ),
          GoRoute(
            path: '/login',
            builder: (_, _) => const Scaffold(body: Text('Login')),
          ),
        ],
      );
      await tester.pumpAndSettle();

      expect(find.text('Welcome to MatchUp'), findsOneWidget);
      expect(find.text('Sign up with email'), findsOneWidget);

      await tester.tap(find.text('Sign up with email'));
      await tester.pumpAndSettle();
      expect(find.text('Register'), findsOneWidget);
    });
  });
}
