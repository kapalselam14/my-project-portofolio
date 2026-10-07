// Dark mode smoke test — PRD Phase 5 dark mode migration (tasks #7-#12).
//
// This does not assert on colours or contrast (that needs a human/visual
// pass — see the WCAG manual-testing caveat noted in the completion
// report). It only confirms that pumping representative screens under a
// dark `ThemeData` (with `AppColorTokens.dark` registered) renders without
// throwing — the concrete risk this migration introduced was screens still
// reading `AppColors.*` (light-only) constants directly, or a `context
// .colors` call site missing the theme extension, either of which would
// surface as a build-time exception here, not as a subtly wrong colour.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:mocktail/mocktail.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:matchup_mobile/core/providers/repository_providers.dart';
import 'package:matchup_mobile/core/theme/app_colors.dart';
import 'package:matchup_mobile/core/theme/app_typography.dart';
import 'package:matchup_mobile/core/theme/dark_colors.dart';
import 'package:matchup_mobile/features/activities/domain/activity_model.dart';
import 'package:matchup_mobile/features/activities/presentation/join_request_sent_screen.dart';
import 'package:matchup_mobile/features/activities/presentation/my_activities_screen.dart';
import 'package:matchup_mobile/features/discovery/data/activity_repository.dart';
import 'package:matchup_mobile/features/discovery/presentation/discovery_screen.dart';
import 'package:matchup_mobile/features/notifications/data/notification_repository.dart';
import 'package:matchup_mobile/features/notifications/domain/app_notification.dart';
import 'package:matchup_mobile/features/profile/data/user_repository.dart';
import 'package:matchup_mobile/features/profile/domain/user_model.dart';
import 'package:matchup_mobile/features/profile/presentation/profile_screen.dart';
import 'package:matchup_mobile/features/tour/presentation/tour_controller.dart';
import 'package:matchup_mobile/features/tour/presentation/tour_host.dart';
import 'package:matchup_mobile/features/tour/presentation/tour_steps.dart';

class _MockActivityRepository extends Mock implements ActivityRepository {}

class _MockNotificationRepository extends Mock
    implements NotificationRepository {}

class _MockUserRepository extends Mock implements UserRepository {}

/// Minimal dark `ThemeData` mirroring `MatchUpApp._buildDarkTheme()` closely
/// enough for a smoke test: it must register `AppColorTokens.dark` (that's
/// what makes `context.colors.*` resolve to dark values instead of the
/// `AppColorTokens.light` fallback) and set `brightness: Brightness.dark` so
/// any Material-driven default (e.g. `Scaffold`'s `Material` ink colour)
/// matches too.
ThemeData _darkThemeForTest() {
  return ThemeData(
    useMaterial3: true,
    brightness: Brightness.dark,
    colorScheme: const ColorScheme.dark(
      primary: AppColors.primary,
      onPrimary: AppColors.textOnPrimary,
      surface: DarkPalette.surface,
      onSurface: DarkPalette.textPrimary,
      error: AppColors.error,
      onError: AppColors.textOnPrimary,
    ),
    fontFamily: AppTypography.fontFamily,
    scaffoldBackgroundColor: DarkPalette.background,
    extensions: const [AppColorTokens.dark],
  );
}

ActivityModel _activityFixture() => ActivityModel(
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
);

void main() {
  setUpAll(() {
    // DiscoveryScreen restores the persisted filter via SharedPreferences
    // on mount — mock it so the store resolves immediately.
    SharedPreferences.setMockInitialValues({});
  });
  // Fails the test if *any* widget throws during build/layout/paint, not
  // just the ones an explicit `expect` happens to touch — the whole point
  // of this smoke test.
  Future<void> expectNoRenderExceptions(WidgetTester tester, Widget app) async {
    final errors = <Object>[];
    final originalOnError = FlutterError.onError;
    FlutterError.onError = (details) {
      errors.add(details.exception);
      originalOnError?.call(details);
    };
    addTearDown(() => FlutterError.onError = originalOnError);

    await tester.pumpWidget(app);
    await tester.pumpAndSettle();

    expect(
      errors,
      isEmpty,
      reason: 'Widget tree threw while rendering under dark theme: $errors',
    );
  }

  group('Dark mode smoke test', () {
    testWidgets('DiscoveryScreen renders without exceptions under dark theme', (
      tester,
    ) async {
      await tester.binding.setSurfaceSize(const Size(390, 844));
      addTearDown(() => tester.binding.setSurfaceSize(null));

      final activityRepo = _MockActivityRepository();
      final notifRepo = _MockNotificationRepository();
      when(
        () => activityRepo.feed(
          limit: any(named: 'limit'),
          offset: any(named: 'offset'),
          filter: any(named: 'filter'),
        ),
      ).thenAnswer((_) async => [_activityFixture()]);
      when(
        () => notifRepo.all(),
      ).thenAnswer((_) async => const <AppNotification>[]);

      final router = GoRouter(
        initialLocation: '/discovery',
        routes: [
          GoRoute(
            path: '/discovery',
            builder: (_, _) => const DiscoveryScreen(),
          ),
        ],
      );

      await expectNoRenderExceptions(
        tester,
        ProviderScope(
          overrides: [
            activityRepositoryProvider.overrideWithValue(activityRepo),
            notificationRepositoryProvider.overrideWithValue(notifRepo),
          ],
          child: MaterialApp.router(
            theme: _darkThemeForTest(),
            routerConfig: router,
          ),
        ),
      );
    });

    testWidgets(
      'MyActivitiesScreen (all three tabs) renders without exceptions under '
      'dark theme',
      (tester) async {
        final activityRepo = _MockActivityRepository();
        final notifRepo = _MockNotificationRepository();
        when(
          () => activityRepo.joinedByUser(any()),
        ).thenAnswer((_) async => [_activityFixture()]);
        when(
          () => activityRepo.hostedByUser(any()),
        ).thenAnswer((_) async => [_activityFixture()]);
        when(
          () => activityRepo.pastByUser(any()),
        ).thenAnswer((_) async => [_activityFixture()]);
        when(
          () => notifRepo.all(),
        ).thenAnswer((_) async => const <AppNotification>[]);

        final router = GoRouter(
          initialLocation: '/activities',
          routes: [
            GoRoute(
              path: '/activities',
              builder: (_, _) => const MyActivitiesScreen(),
            ),
          ],
        );

        await expectNoRenderExceptions(
          tester,
          ProviderScope(
            overrides: [
              activityRepositoryProvider.overrideWithValue(activityRepo),
              notificationRepositoryProvider.overrideWithValue(notifRepo),
              // Bypass real SecureTokenStore (no platform channel in tests).
              myGamesUidProvider.overrideWith(
                (ref) => Future.value('test-uid'),
              ),
            ],
            child: MaterialApp.router(
              theme: _darkThemeForTest(),
              routerConfig: router,
            ),
          ),
        );

        // Switch to Past and Hosting — different status-pill colours and
        // card branches than the default Upcoming tab.
        await tester.tap(find.text('Past'));
        await tester.pumpAndSettle();
        await tester.tap(find.text('Hosting'));
        await tester.pumpAndSettle();
      },
    );

    testWidgets('ProfileScreen renders without exceptions under dark theme', (
      tester,
    ) async {
      final userRepo = _MockUserRepository();
      when(() => userRepo.me()).thenAnswer(
        (_) async => const UserModel(
          id: 'me',
          displayName: 'Alex Mercer',
          rating: 4.9,
          activitiesCount: 27,
          hostedCount: 11,
          sports: [(sport: 'Basketball', level: 'Intermediate')],
        ),
      );

      final router = GoRouter(
        initialLocation: '/profile',
        routes: [
          GoRoute(path: '/profile', builder: (_, _) => const ProfileScreen()),
        ],
      );

      await expectNoRenderExceptions(
        tester,
        ProviderScope(
          overrides: [userRepositoryProvider.overrideWithValue(userRepo)],
          child: MaterialApp.router(
            theme: _darkThemeForTest(),
            routerConfig: router,
          ),
        ),
      );
      // Waits for ProfileScreen's count-up animation to finish.
      await tester.pump(const Duration(milliseconds: 950));
    });

    testWidgets(
      'first-run tour spotlight + callout render without exceptions under '
      'dark theme',
      (tester) async {
        await tester.binding.setSurfaceSize(const Size(390, 844));
        addTearDown(() => tester.binding.setSurfaceSize(null));

        final activityRepo = _MockActivityRepository();
        final notifRepo = _MockNotificationRepository();
        when(
          () => activityRepo.feed(
            limit: any(named: 'limit'),
            offset: any(named: 'offset'),
            filter: any(named: 'filter'),
          ),
        ).thenAnswer((_) async => [_activityFixture()]);
        when(
          () => notifRepo.all(),
        ).thenAnswer((_) async => const <AppNotification>[]);

        // TourHost only exists inside AppShell in production; wrap it here
        // explicitly since this test pumps DiscoveryScreen standalone
        // (matching the plain-DiscoveryScreen test above) rather than
        // going through the full ShellRoute.
        final router = GoRouter(
          initialLocation: '/discovery',
          routes: [
            GoRoute(
              path: '/discovery',
              builder: (_, _) => TourHost(
                location: '/discovery',
                child: const DiscoveryScreen(),
              ),
            ),
          ],
        );
        final container = ProviderContainer(
          overrides: [
            activityRepositoryProvider.overrideWithValue(activityRepo),
            notificationRepositoryProvider.overrideWithValue(notifRepo),
          ],
        );
        addTearDown(container.dispose);

        await expectNoRenderExceptions(
          tester,
          UncontrolledProviderScope(
            container: container,
            child: MaterialApp.router(
              theme: _darkThemeForTest(),
              routerConfig: router,
            ),
          ),
        );

        // Drive through the centered welcome step (no anchor) into an
        // anchored step (swipe deck) — covers both SpotlightOverlay
        // branches (holeRect null vs non-null) under dark theme in one go.
        container
            .read(tourControllerProvider.notifier)
            .start(kFirstRunTourId, kFirstRunTour);
        await tester.pumpAndSettle();
        expect(find.text('Welcome to MatchUp'), findsOneWidget);

        await tester.tap(find.text('Next'));
        await tester.pumpAndSettle();
        expect(find.text('Swipe to find games'), findsOneWidget);
      },
    );

    testWidgets(
      'JoinRequestSentScreen renders without exceptions under dark theme',
      (tester) async {
        await tester.binding.setSurfaceSize(const Size(390, 844));
        addTearDown(() => tester.binding.setSurfaceSize(null));

        final activityRepo = _MockActivityRepository();
        when(
          () => activityRepo.byId(any()),
        ).thenAnswer((_) async => _activityFixture());

        final router = GoRouter(
          initialLocation: '/request-sent/9',
          routes: [
            GoRoute(
              path: '/request-sent/:id',
              builder: (_, state) => JoinRequestSentScreen(
                activityId: state.pathParameters['id']!,
              ),
            ),
          ],
        );

        await expectNoRenderExceptions(
          tester,
          ProviderScope(
            overrides: [
              activityRepositoryProvider.overrideWithValue(activityRepo),
            ],
            child: MaterialApp.router(
              theme: _darkThemeForTest(),
              routerConfig: router,
            ),
          ),
        );

        expect(find.text('Request sent!'), findsOneWidget);
      },
    );
  });
}
