import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:mocktail/mocktail.dart';

import 'package:matchup_mobile/core/providers/repository_providers.dart';
import 'package:matchup_mobile/features/activities/domain/activity_model.dart';
import 'package:matchup_mobile/features/activities/presentation/pending_request_detail_screen.dart';
import 'package:matchup_mobile/features/discovery/data/activity_repository.dart';
import 'package:matchup_mobile/core/utils/nav_guard.dart';

class _MockActivityRepository extends Mock implements ActivityRepository {}

ActivityModel _activity() => ActivityModel(
  id: '9',
  title: 'Evening Tennis',
  sportType: 'Tennis',
  description: 'Friendly sets.',
  location: 'City Courts',
  distanceKm: 2.0,
  dateTime: DateTime.now().add(const Duration(days: 1)),
  skillLevel: 'Intermediate',
  capacity: 4,
  participantCount: 2,
  hostName: 'Sam',
  joinPolicy: 'approval',
);

void main() {
  late _MockActivityRepository repo;

  setUp(() {
    NavGuard.resetForTest();
    repo = _MockActivityRepository();
    when(() => repo.byId('9')).thenAnswer((_) async => _activity());
    when(() => repo.leave(any())).thenAnswer((_) async {});
  });

  Future<void> pumpScreen(WidgetTester tester) async {
    final router = GoRouter(
      initialLocation: '/pending-request/9',
      routes: [
        GoRoute(
          path: '/pending-request/:id',
          builder: (_, state) => PendingRequestDetailScreen(
            activityId: state.pathParameters['id']!,
          ),
        ),
        GoRoute(
          path: '/',
          builder: (_, _) => const Scaffold(body: Text('Home')),
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

  group('PendingRequestDetailScreen', () {
    testWidgets('should render read-only waiting state', (tester) async {
      await pumpScreen(tester);

      expect(find.text('Waiting for host approval'), findsOneWidget);
      expect(find.text('Evening Tennis'), findsOneWidget);
      expect(find.text('Cancel Request'), findsOneWidget);
      // No participant affordances: no chat entry, no check-in.
      expect(find.text('Check In'), findsNothing);
      expect(find.bySemanticsLabel('Chat settings'), findsNothing);
    });

    testWidgets('should withdraw the request on confirm', (tester) async {
      await pumpScreen(tester);

      await tester.ensureVisible(find.text('Cancel Request'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Cancel Request'));
      await tester.pumpAndSettle();

      // Confirm dialog.
      expect(find.text('Cancel Request?'), findsOneWidget);
      await tester.tap(find.text('Cancel Request').last);
      await tester.pumpAndSettle();

      verify(() => repo.leave('9')).called(1);
      expect(find.text('Request withdrawn.'), findsOneWidget);
    });
  });
}
