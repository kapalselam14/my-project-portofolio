import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

import 'package:matchup_mobile/core/utils/nav_guard.dart';

/// Regression test for "My Games → open activity → Discover → back to
/// My Games → tap the same activity = dead tap".
///
/// `NavGuard.push` holds a per-location claim until the push future
/// completes (normal pop). But leaving via `go()` (tab switch) replaces
/// the stack, so the pushed page vanishes and its future never
/// completes — the claim hung until the 8s stuck-key backstop expired.
/// Reopening the same location inside that window was silently
/// swallowed. The guard now also releases when the router leaves the
/// pushed location, so re-entry works immediately.
void main() {
  setUp(NavGuard.resetForTest);

  Future<void> pumpShell(WidgetTester tester) async {
    final router = GoRouter(
      initialLocation: '/home',
      routes: [
        ShellRoute(
          builder: (context, state, child) => Scaffold(body: child),
          routes: [
            GoRoute(
              path: '/home',
              builder: (context, _) => Scaffold(
                body: Center(
                  child: TextButton(
                    onPressed: () => NavGuard.push(context, '/detail'),
                    child: const Text('Open Detail'),
                  ),
                ),
              ),
            ),
            GoRoute(
              path: '/other',
              builder: (context, _) => Scaffold(
                body: Center(
                  child: TextButton(
                    onPressed: () => context.go('/home'),
                    child: const Text('Back Home'),
                  ),
                ),
              ),
            ),
            GoRoute(
              path: '/detail',
              builder: (context, _) => Scaffold(
                body: Center(
                  child: TextButton(
                    onPressed: () => context.go('/other'),
                    child: const Text('Go Other'),
                  ),
                ),
              ),
            ),
          ],
        ),
      ],
    );
    await tester.pumpWidget(MaterialApp.router(routerConfig: router));
    await tester.pumpAndSettle();
  }

  testWidgets('re-pushing the same location after a go-away works', (
    tester,
  ) async {
    await pumpShell(tester);

    // First open.
    await tester.tap(find.text('Open Detail'));
    await tester.pumpAndSettle();
    expect(find.text('Go Other'), findsOneWidget);

    // Leave via go() (tab switch): the pushed page vanishes without
    // completing the push future.
    await tester.tap(find.text('Go Other'));
    await tester.pumpAndSettle();
    expect(find.text('Back Home'), findsOneWidget);

    // Back to the list.
    await tester.tap(find.text('Back Home'));
    await tester.pumpAndSettle();
    expect(find.text('Open Detail'), findsOneWidget);

    // Same-location re-entry must work immediately (no 8s dead window).
    await tester.tap(find.text('Open Detail'));
    await tester.pumpAndSettle();
    expect(find.text('Go Other'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('rapid double-tap still pushes only once', (tester) async {
    await pumpShell(tester);

    // Second tap lands while the first push is in flight.
    await tester.tap(find.text('Open Detail'));
    await tester.tap(find.text('Open Detail'));
    await tester.pumpAndSettle();

    expect(find.text('Go Other'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
}
