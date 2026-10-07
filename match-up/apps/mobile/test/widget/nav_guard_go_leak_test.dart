import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

import 'package:matchup_mobile/core/utils/nav_guard.dart';

/// Regression test for the Notifications-bell-goes-dead bug: any bottom
/// tab (`context.go(...)`) tapped while a `NavGuard.push`-ed route (e.g.
/// `/notifications`) is still on the stack replaces the whole route
/// match list without ever popping it — go_router's `ImperativeRouteMatch`
/// completer is only completed from the pop path, so `context.go(...)`
/// discards it unresolved. Without the staleness backstop that would
/// strand the location in `NavGuard`'s in-flight set forever, so every
/// future tap to it would silently no-op until the app restarted.
void main() {
  setUp(NavGuard.resetForTest);

  Future<GoRouter> pumpShell(WidgetTester tester) async {
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
                    onPressed: () => NavGuard.push(context, '/notifications'),
                    child: const Text('Open Notifications'),
                  ),
                ),
              ),
            ),
            GoRoute(
              path: '/other-tab',
              builder: (context, _) =>
                  const Scaffold(body: Center(child: Text('Other tab'))),
            ),
            GoRoute(
              path: '/notifications',
              builder: (context, _) => const Scaffold(
                body: Center(child: Text('Notifications open')),
              ),
            ),
          ],
        ),
      ],
    );
    await tester.pumpWidget(MaterialApp.router(routerConfig: router));
    await tester.pumpAndSettle();
    return router;
  }

  testWidgets('rapid double-tap pushes only one page (no duplicate key)', (
    tester,
  ) async {
    await pumpShell(tester);

    await tester.tap(find.text('Open Notifications'));
    await tester.pump(const Duration(milliseconds: 50));
    await tester.tap(find.text('Open Notifications'));
    await tester.pumpAndSettle();

    expect(find.text('Notifications open'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets(
    'NavGuard.push self-heals after context.go() abandons the pushed route',
    (tester) async {
      final router = await pumpShell(tester);

      await tester.tap(find.text('Open Notifications'));
      await tester.pumpAndSettle();
      expect(find.text('Notifications open'), findsOneWidget);

      // Simulate a bottom-tab tap: go() wholesale-replaces the route
      // stack instead of popping, so the earlier push's Future is
      // abandoned unresolved.
      router.go('/other-tab');
      await tester.pumpAndSettle();
      expect(find.text('Other tab'), findsOneWidget);

      router.go('/home');
      await tester.pumpAndSettle();

      // Force the staleness window to elapse deterministically, then a
      // genuinely new tap must work again without an app restart.
      await tester.pump(const Duration(seconds: 9));

      await tester.tap(find.text('Open Notifications'));
      await tester.pumpAndSettle();
      expect(find.text('Notifications open'), findsOneWidget);
      expect(tester.takeException(), isNull);
    },
  );
}
