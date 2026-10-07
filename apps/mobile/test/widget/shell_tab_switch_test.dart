import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:mocktail/mocktail.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:matchup_mobile/app/app_shell.dart';
import 'package:matchup_mobile/core/providers/repository_providers.dart';
import 'package:matchup_mobile/core/utils/nav_guard.dart';
import 'package:matchup_mobile/features/activities/domain/activity_model.dart';
import 'package:matchup_mobile/features/discovery/data/activity_repository.dart';
import 'package:matchup_mobile/features/discovery/data/swipes_repository.dart';
import 'package:matchup_mobile/features/discovery/domain/swipe_decision.dart';
import 'package:matchup_mobile/features/discovery/presentation/discovery_screen.dart';
import 'package:matchup_mobile/features/notifications/data/notification_repository.dart';
import 'package:matchup_mobile/features/notifications/domain/app_notification.dart';
import 'package:matchup_mobile/features/notifications/presentation/notifications_screen.dart';

class _MockActivityRepository extends Mock implements ActivityRepository {}

class _MockNotificationRepository extends Mock
    implements NotificationRepository {}

class _MockSwipesRepository extends Mock implements SwipesRepository {}

/// Regression: from the notifications screen, tapping Discover in the
/// bottom nav must actually navigate. Uses the production [AppShell]
/// (not a flat test scaffold) because tab switching is shell behavior.
void main() {
  late _MockActivityRepository activityRepo;
  late _MockNotificationRepository notifRepo;
  late _MockSwipesRepository swipesRepo;

  setUpAll(() {
    SharedPreferences.setMockInitialValues({});
    registerFallbackValue(SwipeDecision.pass);
  });

  setUp(() {
    NavGuard.resetForTest();
    SharedPreferences.setMockInitialValues({});
    activityRepo = _MockActivityRepository();
    notifRepo = _MockNotificationRepository();
    swipesRepo = _MockSwipesRepository();
    when(
      () => activityRepo.feed(
        limit: any(named: 'limit'),
        offset: any(named: 'offset'),
        filter: any(named: 'filter'),
        forceRefresh: any(named: 'forceRefresh'),
      ),
    ).thenAnswer(
      (_) async => [
        ActivityModel(
          id: '1',
          title: 'Saturday Basketball',
          sportType: 'Basketball',
          description: 'Fun pickup game.',
          location: 'Central Park',
          distanceKm: 2.0,
          dateTime: DateTime.now().add(const Duration(hours: 3)),
          skillLevel: 'Intermediate',
          capacity: 10,
          participantCount: 6,
          hostName: 'Alex',
        ),
      ],
    );
    when(() => activityRepo.join(any())).thenAnswer((_) async {});
    when(
      () => swipesRepo.save(
        activityId: any(named: 'activityId'),
        decision: any(named: 'decision'),
      ),
    ).thenAnswer((_) async {});
    when(
      () => notifRepo.all(),
    ).thenAnswer((_) async => const <AppNotification>[]);
  });

  Future<void> pumpShell(WidgetTester tester) async {
    await tester.binding.setSurfaceSize(const Size(390, 844));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    final router = GoRouter(
      initialLocation: '/notifications',
      routes: [
        ShellRoute(
          builder: (context, state, child) => AppShell(child: child),
          routes: [
            GoRoute(
              path: '/discovery',
              builder: (_, _) => const DiscoveryScreen(),
            ),
            GoRoute(
              path: '/notifications',
              builder: (_, _) => const NotificationsScreen(),
            ),
          ],
        ),
      ],
    );
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          activityRepositoryProvider.overrideWithValue(activityRepo),
          notificationRepositoryProvider.overrideWithValue(notifRepo),
          swipesRepositoryProvider.overrideWithValue(swipesRepo),
        ],
        child: MaterialApp.router(routerConfig: router),
      ),
    );
    await tester.pumpAndSettle();
  }

  testWidgets('tapping Discover from notifications opens the deck', (
    tester,
  ) async {
    await pumpShell(tester);
    expect(find.text('Notifications'), findsOneWidget);

    await tester.tap(find.text('Discover'));
    await tester.pumpAndSettle();

    expect(find.text('Saturday Basketball'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
}
