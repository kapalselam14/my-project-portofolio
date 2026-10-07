import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:mocktail/mocktail.dart';

import 'package:matchup_mobile/core/providers/repository_providers.dart';
import 'package:matchup_mobile/features/activities/presentation/join_request_sent_screen.dart';
import 'package:matchup_mobile/features/discovery/data/activity_repository.dart';
import 'package:matchup_mobile/features/discovery/domain/activity_model.dart';

class _MockActivityRepository extends Mock implements ActivityRepository {}

ActivityModel _activity() => ActivityModel(
  id: '7',
  title: 'Sunday Run Club',
  sportType: 'Running',
  description: 'Easy laps.',
  location: 'Auckland Domain',
  distanceKm: 1.2,
  dateTime: DateTime.now().add(const Duration(days: 1)),
  skillLevel: 'Beginner',
  capacity: 12,
  participantCount: 5,
  hostName: 'Sam',
  joinPolicy: 'approval',
);

void main() {
  late _MockActivityRepository repo;

  setUp(() {
    repo = _MockActivityRepository();
    when(() => repo.byId('7')).thenAnswer((_) async => _activity());
  });

  Future<void> pumpScreen(WidgetTester tester) async {
    final router = GoRouter(
      initialLocation: '/request-sent/7',
      routes: [
        GoRoute(
          path: '/request-sent/:id',
          builder: (_, state) =>
              JoinRequestSentScreen(activityId: state.pathParameters['id']!),
        ),
        GoRoute(
          path: '/discovery',
          builder: (_, _) => const Scaffold(body: Text('Discover')),
        ),
        GoRoute(
          path: '/activity/:id',
          builder: (_, state) =>
              Scaffold(body: Text('Detail ${state.pathParameters['id']}')),
        ),
        GoRoute(
          path: '/pending-request/:id',
          builder: (_, state) => Scaffold(
            body: Text('Pending request ${state.pathParameters['id']}'),
          ),
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

  group('JoinRequestSentScreen', () {
    testWidgets('should render pending state + next steps', (tester) async {
      await pumpScreen(tester);

      expect(find.text('Request sent!'), findsOneWidget);
      expect(find.text('Sunday Run Club'), findsOneWidget);
      expect(find.text('What happens next'), findsOneWidget);
      expect(find.text('Back to Discover'), findsOneWidget);
      expect(find.text('View Activity Details'), findsOneWidget);
      // Match-screen copy must not leak in here.
      expect(find.text("It's a Match!"), findsNothing);
    });

    testWidgets('should go back to Discover', (tester) async {
      await pumpScreen(tester);

      await tester.tap(find.text('Back to Discover'));
      await tester.pumpAndSettle();

      expect(find.text('Discover'), findsOneWidget);
    });

    testWidgets('should open pending request details', (tester) async {
      await pumpScreen(tester);

      final details = find.text('View Activity Details');
      await tester.ensureVisible(details);
      await tester.pumpAndSettle();
      await tester.tap(details);
      await tester.pumpAndSettle();

      expect(find.text('Pending request 7'), findsOneWidget);
    });
  });
}
