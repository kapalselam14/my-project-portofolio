import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:mocktail/mocktail.dart';

import 'package:matchup_mobile/core/providers/repository_providers.dart';
import 'package:matchup_mobile/features/activities/domain/activity_participant.dart';
import 'package:matchup_mobile/features/activities/presentation/activity_participants_screen.dart';
import 'package:matchup_mobile/features/discovery/data/activity_repository.dart';
import 'package:matchup_mobile/features/discovery/domain/activity_model.dart';
import 'package:matchup_mobile/core/utils/nav_guard.dart';

class _MockActivityRepository extends Mock implements ActivityRepository {}

void main() {
  late _MockActivityRepository repo;

  setUp(() {
    NavGuard.resetForTest();
    repo = _MockActivityRepository();
    when(
      () => repo.removeParticipant(
        activityId: any(named: 'activityId'),
        uid: any(named: 'uid'),
      ),
    ).thenAnswer((_) async {});
  });

  Future<void> pumpScreen(WidgetTester tester) async {
    final router = GoRouter(
      initialLocation: '/activity/1/participants',
      routes: [
        GoRoute(
          path: '/activity/:id/participants',
          builder: (_, state) => ActivityParticipantsScreen(
            activityId: state.pathParameters['id']!,
          ),
        ),
        GoRoute(
          path: '/player-profile/:name',
          builder: (_, _) => const Scaffold(body: Text('Player Profile')),
        ),
        GoRoute(
          path: '/player-profile/uid/:uid',
          builder: (_, _) => const Scaffold(body: Text('Player Profile')),
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

  group('ActivityParticipantsScreen', () {
    testWidgets(
      'should render real roster data from the repository, not a hardcoded list',
      (tester) async {
        when(() => repo.byId('1')).thenAnswer(
          (_) async => ActivityModel(
            id: '1',
            title: 'Saturday 5v5 Basketball',
            sportType: 'Basketball',
            description: '',
            location: 'Central Park',
            distanceKm: 1,
            dateTime: DateTime(2026, 8, 22, 16),
            skillLevel: 'Intermediate',
            capacity: 4,
            participantCount: 2,
            hostName: 'Priya Nair',
          ),
        );
        when(() => repo.participants('1')).thenAnswer(
          (_) async => [
            ActivityParticipant(
              userId: 'host',
              name: 'Priya Nair',
              avatarAsset: 'host_james.png',
              skillLevel: 'Advanced',
              joinedAt: DateTime.now().subtract(const Duration(days: 3)),
              isOrganizer: true,
            ),
            ActivityParticipant(
              userId: 'u2',
              name: 'Omar Farouk',
              avatarAsset: 'avatar_1.png',
              skillLevel: 'Beginner',
              joinedAt: DateTime.now().subtract(const Duration(hours: 5)),
              isOrganizer: false,
            ),
          ],
        );

        await pumpScreen(tester);

        expect(find.text('Saturday 5v5 Basketball'), findsOneWidget);
        expect(find.text('Priya Nair'), findsOneWidget);
        expect(find.text('Omar Farouk'), findsOneWidget);
        expect(find.text('2/4 spots filled'), findsOneWidget);
        expect(find.text('Organizer'), findsOneWidget);
        // Old hardcoded seed data must not survive the migration.
        expect(find.text('James Wilson'), findsNothing);
        expect(find.text('Marcus Brodie'), findsNothing);
      },
    );

    testWidgets('should push player-profile when a participant row is tapped', (
      tester,
    ) async {
      when(() => repo.byId('1')).thenAnswer(
        (_) async => ActivityModel(
          id: '1',
          title: 'Saturday 5v5 Basketball',
          sportType: 'Basketball',
          description: '',
          location: 'Central Park',
          distanceKm: 1,
          dateTime: DateTime(2026, 8, 22, 16),
          skillLevel: 'Intermediate',
          capacity: 4,
          participantCount: 1,
          hostName: 'Priya Nair',
        ),
      );
      when(() => repo.participants('1')).thenAnswer(
        (_) async => [
          ActivityParticipant(
            userId: 'host',
            name: 'Priya Nair',
            avatarAsset: 'host_james.png',
            skillLevel: 'Advanced',
            joinedAt: DateTime.now().subtract(const Duration(days: 3)),
            isOrganizer: true,
          ),
        ],
      );

      await pumpScreen(tester);
      await tester.tap(find.text('Priya Nair'));
      await tester.pumpAndSettle();

      expect(find.text('Player Profile'), findsOneWidget);
    });

    testWidgets('host sees Remove on members and kicking works', (
      tester,
    ) async {
      when(() => repo.byId('1')).thenAnswer(
        (_) async => ActivityModel(
          id: '1',
          title: 'Saturday 5v5 Basketball',
          sportType: 'Basketball',
          description: '',
          location: 'Central Park',
          distanceKm: 1,
          dateTime: DateTime(2026, 8, 22, 16),
          skillLevel: 'Intermediate',
          capacity: 4,
          participantCount: 2,
          hostName: 'Priya Nair',
          isHost: true,
        ),
      );
      when(() => repo.participants('1')).thenAnswer(
        (_) async => [
          ActivityParticipant(
            userId: 'host',
            name: 'Priya Nair',
            avatarAsset: 'host_james.png',
            skillLevel: 'Advanced',
            joinedAt: DateTime.now().subtract(const Duration(days: 3)),
            isOrganizer: true,
          ),
          ActivityParticipant(
            userId: 'u2',
            name: 'Omar Farouk',
            avatarAsset: 'avatar_1.png',
            skillLevel: 'Beginner',
            joinedAt: DateTime.now().subtract(const Duration(hours: 5)),
            isOrganizer: false,
          ),
        ],
      );

      await pumpScreen(tester);

      // One Remove (member row only — never the organizer row).
      expect(find.text('Remove'), findsOneWidget);
      await tester.tap(find.text('Remove'));
      await tester.pumpAndSettle();

      expect(find.text('Remove Omar Farouk?'), findsOneWidget);
      await tester.tap(find.text('Remove').last);
      await tester.pumpAndSettle();

      verify(
        () => repo.removeParticipant(activityId: '1', uid: 'u2'),
      ).called(1);
      expect(
        find.text('Omar Farouk removed from the activity.'),
        findsOneWidget,
      );
    });

    testWidgets('non-host viewers see no Remove buttons', (tester) async {
      when(() => repo.byId('1')).thenAnswer(
        (_) async => ActivityModel(
          id: '1',
          title: 'Saturday 5v5 Basketball',
          sportType: 'Basketball',
          description: '',
          location: 'Central Park',
          distanceKm: 1,
          dateTime: DateTime(2026, 8, 22, 16),
          skillLevel: 'Intermediate',
          capacity: 4,
          participantCount: 2,
          hostName: 'Priya Nair',
          isParticipant: true,
        ),
      );
      when(() => repo.participants('1')).thenAnswer(
        (_) async => [
          ActivityParticipant(
            userId: 'u2',
            name: 'Omar Farouk',
            avatarAsset: 'avatar_1.png',
            skillLevel: 'Beginner',
            joinedAt: DateTime.now().subtract(const Duration(hours: 5)),
            isOrganizer: false,
          ),
        ],
      );

      await pumpScreen(tester);

      expect(find.text('Remove'), findsNothing);
    });
  });
}
