import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

import 'package:matchup_mobile/features/auth/presentation/login_screen.dart';
import 'package:matchup_mobile/features/auth/presentation/register_screen.dart';

Future<void> _pumpRouter(
  WidgetTester tester, {
  required String initialLocation,
  required List<GoRoute> routes,
}) async {
  final router = GoRouter(initialLocation: initialLocation, routes: routes);
  await tester.pumpWidget(
    ProviderScope(child: MaterialApp.router(routerConfig: router)),
  );
  await tester.pumpAndSettle();
}

void main() {
  group('LoginScreen', () {
    testWidgets('should render the sign-in form and both auth text fields', (
      tester,
    ) async {
      await tester.binding.setSurfaceSize(const Size(430, 932));
      addTearDown(() => tester.binding.setSurfaceSize(null));

      await _pumpRouter(
        tester,
        initialLocation: '/login',
        routes: [
          GoRoute(path: '/login', builder: (_, _) => const LoginScreen()),
          GoRoute(
            path: '/welcome',
            builder: (_, _) => const Scaffold(body: Text('Welcome')),
          ),
          GoRoute(
            path: '/register',
            builder: (_, _) => const Scaffold(body: Text('Register')),
          ),
          GoRoute(
            path: '/forgot-password',
            builder: (_, _) =>
                const Scaffold(body: Text('Forgot Password Screen')),
          ),
        ],
      );

      expect(find.text('Sign In'), findsWidgets);
      expect(find.text('Email'), findsOneWidget);
      expect(find.text('Password'), findsOneWidget);
      expect(find.text('Forgot Password?'), findsOneWidget);
    });

    testWidgets(
      'should show a validation error when submitting an empty form',
      (tester) async {
        await tester.binding.setSurfaceSize(const Size(430, 932));
        addTearDown(() => tester.binding.setSurfaceSize(null));

        await _pumpRouter(
          tester,
          initialLocation: '/login',
          routes: [
            GoRoute(path: '/login', builder: (_, _) => const LoginScreen()),
            GoRoute(
              path: '/welcome',
              builder: (_, _) => const Scaffold(body: Text('Welcome')),
            ),
          ],
        );

        await tester.tap(find.text('Sign In').last);
        await tester.pumpAndSettle();

        expect(find.text('Email is required'), findsOneWidget);
        expect(find.text('Password is required'), findsOneWidget);
      },
    );

    testWidgets('should navigate to forgot-password when the link is tapped', (
      tester,
    ) async {
      await tester.binding.setSurfaceSize(const Size(430, 932));
      addTearDown(() => tester.binding.setSurfaceSize(null));

      await _pumpRouter(
        tester,
        initialLocation: '/login',
        routes: [
          GoRoute(path: '/login', builder: (_, _) => const LoginScreen()),
          GoRoute(
            path: '/forgot-password',
            builder: (_, _) =>
                const Scaffold(body: Text('Forgot Password Screen')),
          ),
        ],
      );

      await tester.tap(find.text('Forgot Password?'));
      await tester.pumpAndSettle();

      expect(find.text('Forgot Password Screen'), findsOneWidget);
    });

    testWidgets('should navigate to welcome when the close button is tapped', (
      tester,
    ) async {
      await tester.binding.setSurfaceSize(const Size(430, 932));
      addTearDown(() => tester.binding.setSurfaceSize(null));

      await _pumpRouter(
        tester,
        initialLocation: '/login',
        routes: [
          GoRoute(path: '/login', builder: (_, _) => const LoginScreen()),
          GoRoute(
            path: '/welcome',
            builder: (_, _) => const Scaffold(body: Text('Welcome')),
          ),
        ],
      );

      await tester.tap(
        find.byIcon(Icons.close).evaluate().isNotEmpty
            ? find.byIcon(Icons.close)
            : find.byType(GestureDetector).first,
      );
      await tester.pumpAndSettle();

      expect(find.text('Welcome'), findsOneWidget);
    });
  });

  group('RegisterScreen', () {
    testWidgets('should render the sign-up form fields', (tester) async {
      await tester.binding.setSurfaceSize(const Size(430, 932));
      addTearDown(() => tester.binding.setSurfaceSize(null));

      await _pumpRouter(
        tester,
        initialLocation: '/register',
        routes: [
          GoRoute(path: '/register', builder: (_, _) => const RegisterScreen()),
          GoRoute(
            path: '/welcome',
            builder: (_, _) => const Scaffold(body: Text('Welcome')),
          ),
        ],
      );

      expect(find.text('Sign Up'), findsWidgets);
      expect(find.text('Full Name'), findsOneWidget);
      expect(find.text('Confirm Password'), findsOneWidget);
    });

    testWidgets('should validate password length on submit', (tester) async {
      await tester.binding.setSurfaceSize(const Size(430, 932));
      addTearDown(() => tester.binding.setSurfaceSize(null));

      await _pumpRouter(
        tester,
        initialLocation: '/register',
        routes: [
          GoRoute(path: '/register', builder: (_, _) => const RegisterScreen()),
        ],
      );

      // Redesign removed the strength meter/checklist — the current UI
      // validates min 8 chars + letter + number on submit.
      expect(find.text('At least 8 characters'), findsNothing);

      await tester.enterText(
        find.widgetWithText(TextFormField, 'Enter your full name'),
        'Jordan Lee',
      );
      await tester.enterText(
        find.widgetWithText(TextFormField, 'Enter your email'),
        'jordan@example.com',
      );
      await tester.enterText(
        find.widgetWithText(TextFormField, 'Create a strong password'),
        'Pw1',
      );
      await tester.enterText(
        find.widgetWithText(TextFormField, 'Confirm your password'),
        'Pw1',
      );
      final createAccount = find.text('Create Account');
      await tester.ensureVisible(createAccount);
      await tester.pumpAndSettle();
      await tester.tap(createAccount);
      await tester.pumpAndSettle();

      expect(
        find.text('Password must be at least 8 characters'),
        findsOneWidget,
      );
    });

    testWidgets('should require a letter and a number in the password', (
      tester,
    ) async {
      await tester.binding.setSurfaceSize(const Size(430, 932));
      addTearDown(() => tester.binding.setSurfaceSize(null));

      await _pumpRouter(
        tester,
        initialLocation: '/register',
        routes: [
          GoRoute(path: '/register', builder: (_, _) => const RegisterScreen()),
        ],
      );

      await tester.enterText(
        find.widgetWithText(TextFormField, 'Enter your full name'),
        'Jordan Lee',
      );
      await tester.enterText(
        find.widgetWithText(TextFormField, 'Enter your email'),
        'jordan@example.com',
      );
      await tester.enterText(
        find.widgetWithText(TextFormField, 'Create a strong password'),
        'password',
      );
      await tester.enterText(
        find.widgetWithText(TextFormField, 'Confirm your password'),
        'password',
      );
      await tester.tap(find.text('Create Account'));
      await tester.pumpAndSettle();

      expect(
        find.text('Password must include a letter and a number'),
        findsOneWidget,
      );
    });

    testWidgets('should validate name length on submit', (tester) async {
      await tester.binding.setSurfaceSize(const Size(430, 932));
      addTearDown(() => tester.binding.setSurfaceSize(null));

      await _pumpRouter(
        tester,
        initialLocation: '/register',
        routes: [
          GoRoute(path: '/register', builder: (_, _) => const RegisterScreen()),
        ],
      );

      await tester.enterText(
        find.widgetWithText(TextFormField, 'Enter your full name'),
        'J',
      );
      await tester.enterText(
        find.widgetWithText(TextFormField, 'Enter your email'),
        'jordan@example.com',
      );
      await tester.enterText(
        find.widgetWithText(TextFormField, 'Create a strong password'),
        'Password1',
      );
      await tester.enterText(
        find.widgetWithText(TextFormField, 'Confirm your password'),
        'Password1',
      );
      await tester.tap(find.text('Create Account'));
      await tester.pumpAndSettle();

      expect(find.text('Name must be at least 2 characters'), findsOneWidget);
    });

    testWidgets(
      'should show a mismatch error when passwords differ on submit',
      (tester) async {
        await tester.binding.setSurfaceSize(const Size(430, 932));
        addTearDown(() => tester.binding.setSurfaceSize(null));

        await _pumpRouter(
          tester,
          initialLocation: '/register',
          routes: [
            GoRoute(
              path: '/register',
              builder: (_, _) => const RegisterScreen(),
            ),
          ],
        );

        await tester.enterText(
          find.widgetWithText(TextFormField, 'Enter your full name'),
          'Jordan Lee',
        );
        await tester.enterText(
          find.widgetWithText(TextFormField, 'Enter your email'),
          'jordan@example.com',
        );
        await tester.enterText(
          find.widgetWithText(TextFormField, 'Create a strong password'),
          'Password1',
        );
        await tester.enterText(
          find.widgetWithText(TextFormField, 'Confirm your password'),
          'Different1',
        );
        await tester.tap(find.text('Create Account'));
        await tester.pumpAndSettle();

        expect(find.text('Passwords do not match'), findsOneWidget);
      },
    );
  });
}
