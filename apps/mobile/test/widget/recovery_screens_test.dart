import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:mocktail/mocktail.dart';

import 'package:matchup_mobile/core/providers/repository_providers.dart';
import 'package:matchup_mobile/core/utils/nav_guard.dart';
import 'package:matchup_mobile/features/auth/data/auth_repository.dart';
import 'package:matchup_mobile/features/auth/recovery/forgot_password_screen.dart';
import 'package:matchup_mobile/features/auth/recovery/reset_link_sent_screen.dart';

class _MockAuthRepository extends Mock implements AuthRepository {}

/// Shared mock auth repo — stubbed per-test below (success paths).
/// LocalAuthRepository can no longer be used here: it throws NO_BACKEND
/// for every method since dummy data was removed.
final _mockAuth = _MockAuthRepository();

Future<void> _pumpRouter(
  WidgetTester tester, {
  required String initialLocation,
  required List<GoRoute> routes,
}) async {
  final router = GoRouter(initialLocation: initialLocation, routes: routes);
  await tester.pumpWidget(
    ProviderScope(
      overrides: [authRepositoryProvider.overrideWithValue(_mockAuth)],
      child: MaterialApp.router(routerConfig: router),
    ),
  );
  await tester.pumpAndSettle();
}

void main() {
  setUp(() {
    reset(_mockAuth);
    NavGuard.resetForTest();
  });

  group('ForgotPasswordScreen', () {
    testWidgets('should show a validation error for an invalid email', (
      tester,
    ) async {
      await tester.binding.setSurfaceSize(const Size(600, 1000));
      addTearDown(() => tester.binding.setSurfaceSize(null));

      await _pumpRouter(
        tester,
        initialLocation: '/forgot-password',
        routes: [
          GoRoute(
            path: '/forgot-password',
            builder: (_, _) => const ForgotPasswordScreen(),
          ),
        ],
      );

      await tester.enterText(find.byType(TextField), 'not-an-email');
      await tester.tap(find.text('Send Reset Link'));
      await tester.pumpAndSettle();

      expect(find.text('Enter a valid email address'), findsOneWidget);
    });

    testWidgets('should push reset-link-sent with the email once submitted', (
      tester,
    ) async {
      await tester.binding.setSurfaceSize(const Size(600, 1000));
      addTearDown(() => tester.binding.setSurfaceSize(null));
      when(
        () => _mockAuth.forgotPassword(email: any(named: 'email')),
      ).thenAnswer((_) async {});

      await _pumpRouter(
        tester,
        initialLocation: '/forgot-password',
        routes: [
          GoRoute(
            path: '/forgot-password',
            builder: (_, _) => const ForgotPasswordScreen(),
          ),
          GoRoute(
            path: '/reset-link-sent',
            builder: (_, state) {
              final email =
                  state.uri.queryParameters['email'] ??
                  (state.extra as String? ?? '');
              return Scaffold(body: Text('Reset link for $email'));
            },
          ),
        ],
      );

      await tester.enterText(find.byType(TextField), 'jordan@example.com');
      await tester.tap(find.text('Send Reset Link'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 1000));
      await tester.pumpAndSettle();

      expect(find.text('Reset link for jordan@example.com'), findsOneWidget);
    });

    testWidgets('should show an error when sending fails', (tester) async {
      await tester.binding.setSurfaceSize(const Size(600, 1000));
      addTearDown(() => tester.binding.setSurfaceSize(null));
      when(
        () => _mockAuth.forgotPassword(email: any(named: 'email')),
      ).thenThrow(const AuthException('Account not found.'));

      await _pumpRouter(
        tester,
        initialLocation: '/forgot-password',
        routes: [
          GoRoute(
            path: '/forgot-password',
            builder: (_, _) => const ForgotPasswordScreen(),
          ),
          GoRoute(
            path: '/reset-link-sent',
            builder: (_, _) => const Scaffold(body: Text('Reset link sent')),
          ),
        ],
      );

      await tester.enterText(find.byType(TextField), 'jordan@example.com');
      await tester.tap(find.text('Send Reset Link'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 1000));
      await tester.pumpAndSettle();

      // Stays on the form and surfaces the backend message.
      expect(find.text('Account not found.'), findsOneWidget);
      expect(find.text('Reset link sent'), findsNothing);
    });
  });

  group('ResetLinkSentScreen', () {
    testWidgets('should display the email passed via extra', (tester) async {
      await tester.binding.setSurfaceSize(const Size(600, 1000));
      addTearDown(() => tester.binding.setSurfaceSize(null));

      await _pumpRouter(
        tester,
        initialLocation: '/reset-link-sent',
        routes: [
          GoRoute(
            path: '/reset-link-sent',
            builder: (_, _) =>
                const ResetLinkSentScreen(email: 'jordan@example.com'),
          ),
        ],
      );

      expect(find.textContaining('jordan@example.com'), findsOneWidget);
      expect(find.text('Check Your Email'), findsOneWidget);
      expect(find.text('Back to Sign In'), findsOneWidget);
    });

    testWidgets('should start the cooldown on open', (tester) async {
      await tester.binding.setSurfaceSize(const Size(600, 1000));
      addTearDown(() => tester.binding.setSurfaceSize(null));

      await _pumpRouter(
        tester,
        initialLocation: '/reset-link-sent',
        routes: [
          GoRoute(
            path: '/reset-link-sent',
            builder: (_, _) =>
                const ResetLinkSentScreen(email: 'jordan@example.com'),
          ),
        ],
      );

      // Cooldown starts on open: resend is replaced by a countdown.
      expect(find.textContaining('Resend link in'), findsOneWidget);
      expect(find.text('Resend'), findsNothing);
    });

    testWidgets('should resend the link and restart the cooldown', (
      tester,
    ) async {
      await tester.binding.setSurfaceSize(const Size(600, 1000));
      addTearDown(() => tester.binding.setSurfaceSize(null));
      when(
        () => _mockAuth.forgotPassword(email: any(named: 'email')),
      ).thenAnswer((_) async {});

      await _pumpRouter(
        tester,
        initialLocation: '/reset-link-sent',
        routes: [
          GoRoute(
            path: '/reset-link-sent',
            builder: (_, _) =>
                const ResetLinkSentScreen(email: 'jordan@example.com'),
          ),
        ],
      );

      // Wait out the open-cooldown so Resend becomes tappable.
      await tester.pump(const Duration(seconds: 61));
      await tester.pumpAndSettle();
      expect(find.text('Resend'), findsOneWidget);

      await tester.tap(find.text('Resend'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 500));
      await tester.pumpAndSettle();

      verify(
        () => _mockAuth.forgotPassword(email: 'jordan@example.com'),
      ).called(1);
      // Cooldown restarts after resend.
      expect(find.textContaining('Resend link in'), findsOneWidget);
      expect(find.text('Resend'), findsNothing);
    });

    testWidgets('should disable resend when email is empty', (tester) async {
      await tester.binding.setSurfaceSize(const Size(600, 1000));
      addTearDown(() => tester.binding.setSurfaceSize(null));

      await _pumpRouter(
        tester,
        initialLocation: '/reset-link-sent',
        routes: [
          GoRoute(
            path: '/reset-link-sent',
            builder: (_, _) => const ResetLinkSentScreen(email: ''),
          ),
        ],
      );
      await tester.pump(const Duration(seconds: 61));
      await tester.pumpAndSettle();

      expect(find.text('Resend'), findsNothing);
      expect(find.text('Open this link from your email app.'), findsOneWidget);
    });
  });
}
