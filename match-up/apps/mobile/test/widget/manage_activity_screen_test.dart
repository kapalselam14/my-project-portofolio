import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:mocktail/mocktail.dart';

import 'package:matchup_mobile/core/providers/repository_providers.dart';
import 'package:matchup_mobile/features/activities/domain/activity_participant.dart';
import 'package:matchup_mobile/features/activities/presentation/edit_activity_screen.dart';
import 'package:matchup_mobile/features/activities/presentation/manage_activity_screen.dart';
import 'package:matchup_mobile/features/discovery/data/activity_repository.dart';
import 'package:matchup_mobile/features/discovery/domain/activity_model.dart';
import 'package:matchup_mobile/core/utils/nav_guard.dart';

class _MockActivityRepository extends Mock implements ActivityRepository {}

void main() {
  late _MockActivityRepository repo;

  setUp(() {
    NavGuard.resetForTest();
    repo = _MockActivityRepository();
    when(() => repo.cancel(any())).thenAnswer((_) async {});
    when(() => repo.joinRequests(any())).thenAnswer((_) async => []);
    when(() => repo.approveJoinRequest(any(), any())).thenAnswer((_) async {});
    when(() => repo.declineJoinRequest(any(), any())).thenAnswer((_) async {});
    when(
      () => repo.removeParticipant(
        activityId: any(named: 'activityId'),
        uid: any(named: 'uid'),
      ),
    ).thenAnswer((_) async {});
    when(
      () => repo.updateActivity(
        activityId: any(named: 'activityId'),
        title: any(named: 'title'),
        sportType: any(named: 'sportType'),
        description: any(named: 'description'),
        locationName: any(named: 'locationName'),
        latitude: any(named: 'latitude'),
        longitude: any(named: 'longitude'),
        geohash: any(named: 'geohash'),
        startTime: any(named: 'startTime'),
        endTime: any(named: 'endTime'),
        skillLevel: any(named: 'skillLevel'),
        capacity: any(named: 'capacity'),
        joinPolicy: any(named: 'joinPolicy'),
        isPaid: any(named: 'isPaid'),
        fee: any(named: 'fee'),
      ),
    ).thenAnswer((_) async {});
  });

  ActivityModel activity({
    ActivityStatus status = ActivityStatus.available,
    String joinPolicy = 'open',
    String lifecycleStatus = '',
  }) {
    return ActivityModel(
      id: '5',
      title: 'Thursday Night Volleyball',
      sportType: 'Volleyball',
      description: '',
      location: 'Eastside Rec Centre',
      distanceKm: 2,
      dateTime: DateTime(2026, 8, 27, 19),
      skillLevel: 'Intermediate',
      capacity: 8,
      participantCount: 5,
      hostName: 'Noor Haddad',
      status: status,
      joinPolicy: joinPolicy,
      lifecycleStatus: lifecycleStatus,
      latitude: -36.8485,
      longitude: 174.7633,
    );
  }

  Future<void> pumpScreen(WidgetTester tester) async {
    final router = GoRouter(
      initialLocation: '/manage-activity/5',
      routes: [
        GoRoute(
          path: '/manage-activity/:id',
          builder: (_, state) =>
              ManageActivityScreen(activityId: state.pathParameters['id']!),
        ),
        GoRoute(
          path: '/activity/:id/participants',
          builder: (_, _) => const Scaffold(body: Text('Participants')),
        ),
        GoRoute(
          path: '/edit-activity/:id',
          builder: (_, state) =>
              EditActivityScreen(activityId: state.pathParameters['id']!),
        ),
        GoRoute(
          path: '/chat/:id',
          builder: (_, state) =>
              Scaffold(body: Text('Chat ${state.pathParameters['id']}')),
        ),
        GoRoute(
          path: '/player-profile/:name',
          builder: (_, state) =>
              Scaffold(body: Text('Profile ${state.pathParameters['name']}')),
        ),
        GoRoute(
          path: '/player-profile/uid/:uid',
          builder: (_, state) => Scaffold(
            body: Text('Profile uid:${state.pathParameters['uid']}'),
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

  group('ManageActivityScreen', () {
    testWidgets(
      'should render real activity + roster data, not the old hardcoded seed',
      (tester) async {
        when(() => repo.byId('5')).thenAnswer((_) async => activity());
        when(() => repo.participants('5')).thenAnswer(
          (_) async => [
            ActivityParticipant(
              userId: 'host',
              name: 'Noor Haddad',
              avatarAsset: 'host_james.png',
              skillLevel: 'Advanced',
              joinedAt: DateTime.now().subtract(const Duration(days: 4)),
              isOrganizer: true,
              isCheckedIn: true,
            ),
            ActivityParticipant(
              userId: 'u2',
              name: 'Tavita Faleolo',
              avatarAsset: 'avatar_1.png',
              skillLevel: 'Beginner',
              joinedAt: DateTime.now().subtract(const Duration(hours: 6)),
              isOrganizer: false,
            ),
          ],
        );

        await pumpScreen(tester);

        expect(find.text('Thursday Night Volleyball'), findsOneWidget);
        expect(find.text('Noor Haddad'), findsOneWidget);
        expect(find.text('Tavita Faleolo'), findsOneWidget);
        expect(find.text('Participants (2)'), findsOneWidget);
        expect(find.text('CHECKED IN'), findsOneWidget);
        expect(find.text('JOINED'), findsOneWidget);
        // Old hardcoded seed content must be gone.
        expect(find.text('Friendly 5v5 Run at Prospect'), findsNothing);
        expect(find.text('James Wilson'), findsNothing);
      },
    );

    testWidgets(
      'should call activityRepository.cancel and pop after confirming cancel',
      (tester) async {
        when(() => repo.byId('5')).thenAnswer((_) async => activity());
        when(() => repo.participants('5')).thenAnswer((_) async => []);

        await pumpScreen(tester);
        await tester.scrollUntilVisible(
          find.text('Cancel Activity'),
          300,
          scrollable: find.byType(Scrollable).first,
        );
        await tester.tap(find.text('Cancel Activity'));
        await tester.pumpAndSettle();

        await tester.tap(find.text('Cancel Activity').last);
        await tester.pumpAndSettle();

        verify(() => repo.cancel('5')).called(1);
      },
    );

    testWidgets(
      'should list pending join requests with approve/decline actions',
      (tester) async {
        when(
          () => repo.byId('5'),
        ).thenAnswer((_) async => activity(joinPolicy: 'approval'));
        when(() => repo.participants('5')).thenAnswer((_) async => []);
        when(() => repo.joinRequests('5')).thenAnswer(
          (_) async => [
            ActivityParticipant(
              userId: 'u9',
              name: 'Pending Petra',
              avatarAsset: 'avatar_1.png',
              skillLevel: 'Beginner',
              joinedAt: DateTime.now(),
              isOrganizer: false,
            ),
          ],
        );

        await pumpScreen(tester);
        await tester.scrollUntilVisible(
          find.text('Join requests (1)'),
          300,
          scrollable: find.byType(Scrollable).first,
        );

        expect(find.text('Join requests (1)'), findsOneWidget);
        expect(find.text('Pending Petra'), findsOneWidget);
        expect(find.text('Approve'), findsOneWidget);
        expect(find.text('Decline'), findsOneWidget);

        await tester.tap(find.text('Approve'));
        await tester.pumpAndSettle();

        verify(() => repo.approveJoinRequest('5', 'u9')).called(1);
      },
    );

    testWidgets('should push participants when "View all" is tapped', (
      tester,
    ) async {
      when(() => repo.byId('5')).thenAnswer((_) async => activity());
      when(() => repo.participants('5')).thenAnswer(
        (_) async => [
          ActivityParticipant(
            userId: 'host',
            name: 'Noor Haddad',
            avatarAsset: 'host_james.png',
            skillLevel: 'Advanced',
            joinedAt: DateTime.now(),
            isOrganizer: true,
            isCheckedIn: true,
          ),
        ],
      );

      await pumpScreen(tester);
      final viewAll = find.text('View all');
      await tester.ensureVisible(viewAll);
      await tester.pumpAndSettle();
      await tester.tap(viewAll);
      await tester.pumpAndSettle();

      expect(find.text('Participants'), findsOneWidget);
    });

    testWidgets('should open the edit screen when Edit is tapped', (
      tester,
    ) async {
      when(() => repo.byId('5')).thenAnswer((_) async => activity());
      when(() => repo.participants('5')).thenAnswer((_) async => []);
      when(() => repo.joinRequests('5')).thenAnswer((_) async => []);

      await pumpScreen(tester);

      await tester.tap(find.bySemanticsLabel('Edit activity'));
      await tester.pumpAndSettle();

      expect(find.text('Edit Activity'), findsOneWidget);
    });

    testWidgets('should open the requester profile from the waiting list', (
      tester,
    ) async {
      when(
        () => repo.byId('5'),
      ).thenAnswer((_) async => activity(joinPolicy: 'approval'));
      when(() => repo.participants('5')).thenAnswer((_) async => []);
      when(() => repo.joinRequests('5')).thenAnswer(
        (_) async => [
          ActivityParticipant(
            userId: 'u9',
            name: 'Pending Petra',
            avatarAsset: 'avatar_1.png',
            skillLevel: 'Beginner',
            joinedAt: DateTime.now(),
            isOrganizer: false,
          ),
        ],
      );

      await pumpScreen(tester);
      await tester.scrollUntilVisible(
        find.text('Pending Petra'),
        300,
        scrollable: find.byType(Scrollable).first,
      );

      // NOTE: tapped by name text — AppTappable merges its explicit
      // label with child text, so bySemanticsLabel never exact-matches.
      await tester.tap(find.text('Pending Petra'));
      await tester.pumpAndSettle();

      expect(find.text('Profile uid:u9'), findsOneWidget);
    });

    testWidgets('host can kick a participant from the preview roster', (
      tester,
    ) async {
      when(() => repo.byId('5')).thenAnswer((_) async => activity());
      when(() => repo.participants('5')).thenAnswer(
        (_) async => [
          ActivityParticipant(
            userId: 'host',
            name: 'Noor Haddad',
            avatarAsset: 'host_james.png',
            skillLevel: 'Advanced',
            joinedAt: DateTime.now(),
            isOrganizer: true,
          ),
          ActivityParticipant(
            userId: 'u2',
            name: 'Tavita Faleolo',
            avatarAsset: 'avatar_1.png',
            skillLevel: 'Beginner',
            joinedAt: DateTime.now(),
            isOrganizer: false,
          ),
        ],
      );

      await pumpScreen(tester);
      await tester.scrollUntilVisible(
        find.text('Tavita Faleolo'),
        300,
        scrollable: find.byType(Scrollable).first,
      );

      // Organizer row never offers Remove; member row does.
      expect(find.text('Remove'), findsOneWidget);
      await tester.tap(find.text('Remove'));
      await tester.pumpAndSettle();

      // Confirm dialog → confirm.
      expect(find.text('Remove Tavita Faleolo?'), findsOneWidget);
      await tester.tap(find.text('Remove').last);
      await tester.pumpAndSettle();

      verify(
        () => repo.removeParticipant(activityId: '5', uid: 'u2'),
      ).called(1);
      expect(
        find.text('Tavita Faleolo removed from the activity.'),
        findsOneWidget,
      );
    });

    testWidgets('Edit should open the full-screen editor and refresh on save', (
      tester,
    ) async {
      when(() => repo.byId('5')).thenAnswer((_) async => activity());
      when(() => repo.participants('5')).thenAnswer((_) async => []);
      when(() => repo.joinRequests('5')).thenAnswer((_) async => []);

      await pumpScreen(tester);

      // Quick-action "Edit" pushes the full-screen editor (hero edit button
      // uses the 'Edit activity' semantics label, so text 'Edit' is unique).
      await tester.scrollUntilVisible(
        find.text('Edit'),
        300,
        scrollable: find.byType(Scrollable).first,
      );
      await tester.tap(find.text('Edit'));
      await tester.pumpAndSettle();

      // Full-screen editor — no bottom sheet, no tab bar.
      expect(find.text('Edit Activity'), findsOneWidget);

      await tester.tap(find.text('Save Changes'));
      await tester.pumpAndSettle();

      verify(
        () => repo.updateActivity(
          activityId: '5',
          title: 'Thursday Night Volleyball',
          sportType: 'Volleyball',
          description: '',
          locationName: 'Eastside Rec Centre',
          latitude: -36.8485,
          longitude: 174.7633,
          geohash: any(named: 'geohash'),
          startTime: DateTime(2026, 8, 27, 19),
          endTime: any(named: 'endTime'),
          skillLevel: 'Intermediate',
          capacity: 8,
          joinPolicy: 'open',
          isPaid: false,
          fee: null,
        ),
      ).called(1);
      // Editor pops with success — manage refreshes and confirms.
      expect(find.text('Edit Activity'), findsNothing);
      expect(find.text('Activity updated.'), findsOneWidget);
    });

    testWidgets('quick-action Chat should push the group chat', (tester) async {
      when(() => repo.byId('5')).thenAnswer((_) async => activity());
      when(() => repo.participants('5')).thenAnswer((_) async => []);
      when(() => repo.joinRequests('5')).thenAnswer((_) async => []);

      await pumpScreen(tester);

      await tester.scrollUntilVisible(
        find.text('Chat'),
        300,
        scrollable: find.byType(Scrollable).first,
      );
      await tester.tap(find.text('Chat'));
      await tester.pumpAndSettle();

      expect(find.text('Chat 5'), findsOneWidget);
    });

    testWidgets('should hide the Cancel button on a cancelled activity', (
      tester,
    ) async {
      when(
        () => repo.byId('5'),
      ).thenAnswer((_) async => activity(lifecycleStatus: 'cancelled'));
      when(() => repo.participants('5')).thenAnswer((_) async => []);
      when(() => repo.joinRequests('5')).thenAnswer((_) async => []);

      await pumpScreen(tester);

      expect(find.text('CANCELLED'), findsOneWidget);
      expect(find.text('Cancel Activity'), findsNothing);
    });
  });
}
