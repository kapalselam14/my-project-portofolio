import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:mocktail/mocktail.dart';

import 'package:matchup_mobile/core/providers/repository_providers.dart';
import 'package:matchup_mobile/features/activities/domain/activity_model.dart';
import 'package:matchup_mobile/features/activities/presentation/my_activities_screen.dart';
import 'package:matchup_mobile/features/discovery/data/activity_repository.dart';
import 'package:matchup_mobile/features/notifications/data/notification_repository.dart';
import 'package:matchup_mobile/features/notifications/domain/app_notification.dart';

class _MockActivityRepository extends Mock implements ActivityRepository {}

class _MockNotificationRepository extends Mock
    implements NotificationRepository {}

ActivityModel _fixture({
  String id = '1',
  String title = 'Saturday Basketball',
  String lifecycleStatus = '',
}) => ActivityModel(
  id: id,
  title: title,
  sportType: 'Basketball',
  description: 'Fun pickup game.',
  location: 'Central Park',
  distanceKm: 2.0,
  dateTime: DateTime.now().add(const Duration(hours: 3)),
  skillLevel: 'Intermediate',
  capacity: 10,
  participantCount: 6,
  hostName: 'Alex',
  lifecycleStatus: lifecycleStatus,
);

void main() {
  late _MockActivityRepository activityRepo;
  late _MockNotificationRepository notifRepo;

  setUp(() {
    activityRepo = _MockActivityRepository();
    notifRepo = _MockNotificationRepository();
    when(
      () => notifRepo.all(),
    ).thenAnswer((_) async => const <AppNotification>[]);
  });

  Future<GoRouter> pumpScreen(WidgetTester tester) async {
    final router = GoRouter(
      initialLocation: '/activities',
      routes: [
        GoRoute(
          path: '/activities',
          builder: (_, _) => const MyActivitiesScreen(),
        ),
        GoRoute(
          path: '/joined-activity/:id',
          builder: (_, state) => Scaffold(
            body: Text('Joined Detail ${state.pathParameters['id']}'),
          ),
        ),
        GoRoute(
          path: '/manage-activity/:id',
          builder: (_, state) =>
              Scaffold(body: Text('Manage ${state.pathParameters['id']}')),
        ),
        GoRoute(
          path: '/past-activity/:id/review',
          builder: (_, _) => const Scaffold(body: Text('Review')),
        ),
        GoRoute(
          path: '/pending-request/:id',
          builder: (_, state) => Scaffold(
            body: Text('Pending Detail ${state.pathParameters['id']}'),
          ),
        ),
        GoRoute(
          path: '/create',
          builder: (_, _) => const Scaffold(body: Text('Create')),
        ),
        GoRoute(
          path: '/discovery',
          builder: (_, _) => const Scaffold(body: Text('Discovery')),
        ),
        GoRoute(
          path: '/notifications',
          builder: (_, _) => const Scaffold(body: Text('Notifications')),
        ),
      ],
    );

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          activityRepositoryProvider.overrideWithValue(activityRepo),
          notificationRepositoryProvider.overrideWithValue(notifRepo),
          // Bypass real SecureTokenStore (no platform channel in tests).
          myGamesUidProvider.overrideWith((ref) => Future.value('test-uid')),
        ],
        child: MaterialApp.router(routerConfig: router),
      ),
    );
    await tester.pumpAndSettle();
    return router;
  }

  group('MyActivitiesScreen', () {
    testWidgets('should render upcoming activities by default', (tester) async {
      when(
        () => activityRepo.joinedByUser(any()),
      ).thenAnswer((_) async => [_fixture()]);
      when(() => activityRepo.hostedByUser(any())).thenAnswer((_) async => []);
      when(() => activityRepo.pastByUser(any())).thenAnswer((_) async => []);

      await pumpScreen(tester);

      expect(find.text('My Games'), findsOneWidget);
      expect(find.text('Saturday Basketball'), findsOneWidget);
    });

    testWidgets('should switch to the Hosting tab and show hosted activities', (
      tester,
    ) async {
      when(() => activityRepo.joinedByUser(any())).thenAnswer((_) async => []);
      when(
        () => activityRepo.hostedByUser(any()),
      ).thenAnswer((_) async => [_fixture(id: '2', title: 'Hosted Match')]);
      when(() => activityRepo.pastByUser(any())).thenAnswer((_) async => []);

      await pumpScreen(tester);

      await tester.tap(find.text('Hosting'));
      await tester.pumpAndSettle();

      expect(find.text('Hosted Match'), findsOneWidget);
      // Status pills were removed from Upcoming/Hosting cards — only the
      // sport pill remains, so assert on that instead.
      expect(find.text('BASKETBALL'), findsWidgets);
    });

    testWidgets(
      'should push manage-activity route when a hosted card is tapped',
      (tester) async {
        when(
          () => activityRepo.joinedByUser(any()),
        ).thenAnswer((_) async => []);
        when(
          () => activityRepo.hostedByUser(any()),
        ).thenAnswer((_) async => [_fixture(id: '9', title: 'Hosted Match')]);
        when(() => activityRepo.pastByUser(any())).thenAnswer((_) async => []);

        await pumpScreen(tester);
        await tester.tap(find.text('Hosting'));
        await tester.pumpAndSettle();

        await tester.tap(find.text('Hosted Match'));
        await tester.pumpAndSettle();

        expect(find.text('Manage 9'), findsOneWidget);
      },
    );

    testWidgets('should show an empty state when the upcoming list is empty', (
      tester,
    ) async {
      when(() => activityRepo.joinedByUser(any())).thenAnswer((_) async => []);
      when(() => activityRepo.hostedByUser(any())).thenAnswer((_) async => []);
      when(() => activityRepo.pastByUser(any())).thenAnswer((_) async => []);

      await pumpScreen(tester);

      expect(find.text('No upcoming activities'), findsOneWidget);
    });

    group('Pending tab', () {
      testWidgets('should list requests with the waiting badge', (
        tester,
      ) async {
        when(
          () => activityRepo.joinedByUser(any()),
        ).thenAnswer((_) async => []);
        when(
          () => activityRepo.hostedByUser(any()),
        ).thenAnswer((_) async => []);
        when(() => activityRepo.pastByUser(any())).thenAnswer((_) async => []);
        when(
          () => activityRepo.pendingRequests(),
        ).thenAnswer((_) async => [_fixture(id: '9', title: 'Evening Tennis')]);

        await pumpScreen(tester);
        await tester.tap(find.text('Pending'));
        await tester.pumpAndSettle();

        expect(find.text('Evening Tennis'), findsOneWidget);
        expect(find.text('WAITING APPROVAL'), findsOneWidget);
      });

      testWidgets('should open the read-only pending detail', (tester) async {
        when(
          () => activityRepo.joinedByUser(any()),
        ).thenAnswer((_) async => []);
        when(
          () => activityRepo.hostedByUser(any()),
        ).thenAnswer((_) async => []);
        when(() => activityRepo.pastByUser(any())).thenAnswer((_) async => []);
        when(
          () => activityRepo.pendingRequests(),
        ).thenAnswer((_) async => [_fixture(id: '9', title: 'Evening Tennis')]);

        await pumpScreen(tester);
        await tester.tap(find.text('Pending'));
        await tester.pumpAndSettle();
        await tester.tap(find.text('Evening Tennis'));
        await tester.pumpAndSettle();

        expect(find.text('Pending Detail 9'), findsOneWidget);
      });
    });

    group('Past tab', () {
      testWidgets('should label a cancelled game instead of a normal one', (
        tester,
      ) async {
        when(
          () => activityRepo.joinedByUser(any()),
        ).thenAnswer((_) async => []);
        when(
          () => activityRepo.hostedByUser(any()),
        ).thenAnswer((_) async => []);
        when(() => activityRepo.pastByUser(any())).thenAnswer(
          (_) async => [
            _fixture(
              id: '7',
              title: 'Called-off Tennis',
              lifecycleStatus: 'cancelled',
            ),
          ],
        );

        await pumpScreen(tester);
        await tester.tap(find.text('Past'));
        await tester.pumpAndSettle();

        expect(find.text('Called-off Tennis'), findsOneWidget);
        expect(find.text('CANCELLED'), findsOneWidget);
      });
    });
  });
}
