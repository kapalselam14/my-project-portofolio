import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

import 'package:matchup_mobile/features/preferences/presentation/preferences_screen.dart';

void main() {
  Future<void> pumpScreen(WidgetTester tester) async {
    final router = GoRouter(
      initialLocation: '/preferences',
      routes: [
        GoRoute(
          path: '/preferences',
          builder: (_, _) => const PreferencesScreen(),
        ),
        GoRoute(
          path: '/discovery',
          builder: (_, _) => const Scaffold(body: Text('Discovery')),
        ),
      ],
    );

    await tester.pumpWidget(
      ProviderScope(child: MaterialApp.router(routerConfig: router)),
    );
    await tester.pumpAndSettle();
  }

  group('PreferencesScreen', () {
    testWidgets('should render the header and default empty state', (
      tester,
    ) async {
      await pumpScreen(tester);
      expect(find.text('Filters'), findsOneWidget);
      expect(find.text('No sports selected'), findsOneWidget);
      expect(find.text('Show all activities'), findsOneWidget);
    });

    testWidgets('should select a skill level and reflect it in the summary', (
      tester,
    ) async {
      await pumpScreen(tester);

      await tester.tap(find.text('Basketball'));
      await tester.pumpAndSettle();

      // Skill sheet is open — save with the default (Beginner).
      expect(find.text('Pick your skill level'), findsOneWidget);
      await tester.tap(find.text('Done'));
      await tester.pumpAndSettle();

      expect(find.text('1 sport selected'), findsOneWidget);
      expect(find.text('Apply Filters'), findsOneWidget);
    });

    testWidgets('should navigate to discovery when Apply Filters is tapped', (
      tester,
    ) async {
      await pumpScreen(tester);
      await tester.tap(find.text('Show all activities'));
      await tester.pumpAndSettle();
      expect(find.text('Discovery'), findsOneWidget);
    });
  });
}
