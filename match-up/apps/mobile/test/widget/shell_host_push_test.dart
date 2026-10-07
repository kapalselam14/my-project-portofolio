import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:mocktail/mocktail.dart';

import 'package:matchup_mobile/core/providers/repository_providers.dart';
import 'package:matchup_mobile/core/utils/nav_guard.dart';
import 'package:matchup_mobile/features/activities/domain/activity_model.dart';
import 'package:matchup_mobile/features/activities/domain/activity_participant.dart';
import 'package:matchup_mobile/features/discovery/data/activity_repository.dart';
import 'package:matchup_mobile/features/discovery/presentation/activity_detail_screen.dart';

/// Regression test for the on-device red screen
/// (`'!keyReservation.contains(key)'`) when tapping the host name on an
/// unjoined activity detail.
///
/// Hypothesis under test: the crash only happens when the pushed routes
/// live INSIDE a ShellRoute like production (all widget tests so far use
/// flat routers, which is why they stay green while the app red-screens).
class _MockActivityRepository extends Mock implements ActivityRepository {}

ActivityModel _fixture() => ActivityModel(
  id: 'a-1',
  title: 'Saturday Afternoon 5v5 Basketball',
  sportType: 'Basketball',
  description: 'Looking for intermediate players.',
  location: 'Central Park Court B',
  addressLine: 'Central Park, New York, NY',
  distanceKm: 2.4,
  dateTime: DateTime(2027, 8, 20, 16),
  skillLevel: 'Intermediate',
  capacity: 10,
  participantCount: 6,
  hostName: 'James Wilson',
);

void main() {
  late _MockActivityRepository repo;

  setUp(() {
    NavGuard.resetForTest();
    repo = _MockActivityRepository();
    when(
      () => repo.byId(any()),
    ).thenAnswer((_) async => _fixture().copyWith(hostId: 'host-1'));
    when(
      () => repo.participants(any()),
    ).thenAnswer((_) async => <ActivityParticipant>[]);
  });

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
                    onPressed: () => context.push('/activity/a-1'),
                    child: const Text('Open Activity'),
                  ),
                ),
              ),
            ),
            GoRoute(
              path: '/activity/:id',
              builder: (_, state) =>
                  ActivityDetailScreen(activityId: state.pathParameters['id']!),
            ),
            GoRoute(
              path: '/player-profile/uid/:uid',
              builder: (_, state) => Scaffold(
                body: Center(
                  child: Text('Host profile ${state.pathParameters['uid']}'),
                ),
              ),
            ),
          ],
        ),
      ],
    );
    await tester.pumpWidget(
      ProviderScope(
        overrides: [activityRepositoryProvider.overrideWithValue(repo)],
        child: MaterialApp.router(routerConfig: router),
      ),
    );
    await tester.pumpAndSettle();
  }

  testWidgets('shell: deck push then host tap shows profile', (tester) async {
    await pumpShell(tester);
    await tester.tap(find.text('Open Activity'));
    await tester.pumpAndSettle();
    expect(find.byType(ActivityDetailScreen), findsOneWidget);

    await tester.tap(find.text('James Wilson'));
    await tester.pumpAndSettle();

    expect(find.text('Host profile host-1'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
}
