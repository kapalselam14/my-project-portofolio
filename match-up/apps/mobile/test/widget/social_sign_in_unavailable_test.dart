import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

import 'package:matchup_mobile/core/utils/social_sign_in.dart';
import 'package:matchup_mobile/features/auth/presentation/login_screen.dart';
import 'package:matchup_mobile/features/auth/presentation/register_screen.dart';
import 'package:matchup_mobile/features/auth/presentation/welcome_screen.dart';

/// Social sign-in has no OAuth behind it yet: every Apple/Google button
/// on every auth screen must stay honest by explaining that on tap
/// instead of silently doing nothing.
void main() {
  group('social sign-in unavailable notice', () {
    testWidgets('welcome Apple button shows the honest notice on tap', (
      tester,
    ) async {
      tester.view.physicalSize = const Size(600, 1000);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.reset);

      await tester.pumpWidget(
        ProviderScope(
          child: MaterialApp.router(
            routerConfig: GoRouter(
              initialLocation: '/welcome',
              routes: [
                GoRoute(
                  path: '/welcome',
                  builder: (_, _) => const WelcomeScreen(),
                ),
                GoRoute(
                  path: '/register',
                  builder: (_, _) => const Scaffold(body: Text('Register')),
                ),
                GoRoute(
                  path: '/login',
                  builder: (_, _) => const Scaffold(body: Text('Login')),
                ),
              ],
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      await tester.tap(find.text('Sign up with Apple'));
      await tester.pumpAndSettle();

      expect(find.text(socialSignInUnavailableMessage), findsOneWidget);
    });

    testWidgets('welcome Google button shows the honest notice on tap', (
      tester,
    ) async {
      tester.view.physicalSize = const Size(600, 1000);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.reset);

      await tester.pumpWidget(
        ProviderScope(
          child: MaterialApp.router(
            routerConfig: GoRouter(
              initialLocation: '/welcome',
              routes: [
                GoRoute(
                  path: '/welcome',
                  builder: (_, _) => const WelcomeScreen(),
                ),
                GoRoute(
                  path: '/register',
                  builder: (_, _) => const Scaffold(body: Text('Register')),
                ),
                GoRoute(
                  path: '/login',
                  builder: (_, _) => const Scaffold(body: Text('Login')),
                ),
              ],
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      await tester.tap(find.text('Sign up with Google'));
      await tester.pumpAndSettle();

      expect(find.text(socialSignInUnavailableMessage), findsOneWidget);
    });

    testWidgets('login social buttons show the honest notice on tap', (
      tester,
    ) async {
      await tester.binding.setSurfaceSize(const Size(430, 932));
      addTearDown(() => tester.binding.setSurfaceSize(null));

      await tester.pumpWidget(
        ProviderScope(
          child: MaterialApp.router(
            routerConfig: GoRouter(
              initialLocation: '/login',
              routes: [
                GoRoute(path: '/login', builder: (_, _) => const LoginScreen()),
                GoRoute(
                  path: '/welcome',
                  builder: (_, _) => const Scaffold(body: Text('Welcome')),
                ),
              ],
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      await tester.tap(find.text('Google'));
      await tester.pumpAndSettle();
      expect(find.text(socialSignInUnavailableMessage), findsOneWidget);

      await tester.tap(find.text('Apple'));
      await tester.pumpAndSettle();
      expect(find.text(socialSignInUnavailableMessage), findsOneWidget);
    });

    testWidgets('register social buttons show the honest notice on tap', (
      tester,
    ) async {
      await tester.binding.setSurfaceSize(const Size(430, 932));
      addTearDown(() => tester.binding.setSurfaceSize(null));

      await tester.pumpWidget(
        ProviderScope(
          child: MaterialApp.router(
            routerConfig: GoRouter(
              initialLocation: '/register',
              routes: [
                GoRoute(
                  path: '/register',
                  builder: (_, _) => const RegisterScreen(),
                ),
                GoRoute(
                  path: '/welcome',
                  builder: (_, _) => const Scaffold(body: Text('Welcome')),
                ),
              ],
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      await tester.tap(find.text('Google'));
      await tester.pumpAndSettle();
      expect(find.text(socialSignInUnavailableMessage), findsOneWidget);

      await tester.tap(find.text('Apple'));
      await tester.pumpAndSettle();
      expect(find.text(socialSignInUnavailableMessage), findsOneWidget);
    });
  });
}
