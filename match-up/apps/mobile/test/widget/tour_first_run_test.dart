import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';
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
import 'package:matchup_mobile/features/discovery/presentation/discovery_screen.dart';
import 'package:matchup_mobile/features/notifications/data/notification_repository.dart';
import 'package:matchup_mobile/features/notifications/domain/app_notification.dart';
import 'package:matchup_mobile/features/profile/data/user_repository.dart';
import 'package:matchup_mobile/features/profile/domain/user_model.dart';
import 'package:matchup_mobile/features/preferences/presentation/get_to_know_1_screen.dart';
import 'package:matchup_mobile/features/preferences/presentation/get_to_know_2_screen.dart';
import 'package:matchup_mobile/features/preferences/presentation/get_to_know_3_screen.dart';
import 'package:matchup_mobile/features/tour/presentation/tour_steps.dart';

class _MockActivityRepository extends Mock implements ActivityRepository {}

class _MockNotificationRepository extends Mock
    implements NotificationRepository {}

class _MockUserRepository extends Mock implements UserRepository {}

/// A single short-copy fixture. `discovery_card.dart`'s info chips have a
/// pre-existing overflow with the wordier copy `DummyActivityRepository`
/// ships (out of scope to fix here) — every other Discovery-rendering test
/// in this suite (discovery_screen_test.dart, dark_mode_smoke_test.dart)
/// already sidesteps it the same way, with a short mock fixture instead of
/// the real repository.
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

/// End-to-end coverage for the real `get-to-know-3 -> Discovery` seam: this
/// drives the actual `GetToKnow3Screen._onNext()` → `maybeStart()` →
/// `AppShell`/`TourHost` chain rather than driving `TourController`
/// directly (that's what `tour_controller_test.dart` and
/// `dark_mode_smoke_test.dart`'s tour case already cover) — the thing this
/// file exists to catch is a wiring regression between those two layers,
/// e.g. the seam call getting removed, or `TourHost` failing to pick up an
/// already-active tour on first mount.
void main() {
  // TourHost only ever mounts inside AppShell's ShellRoute in production,
  // so the router here mirrors that shape for the /discovery destination
  // instead of pumping DiscoveryScreen bare the way the plain
  // get_to_know_screens_test.dart does.
  Future<void> pumpRouter(WidgetTester tester) async {
    final router = GoRouter(
      initialLocation: '/get-to-know-1',
      routes: [
        GoRoute(
          path: '/get-to-know-1',
          builder: (_, _) => const GetToKnow1Screen(),
        ),
        GoRoute(
          path: '/get-to-know-2',
          builder: (_, _) => const GetToKnow2Screen(),
        ),
        GoRoute(
          path: '/get-to-know-3',
          builder: (_, _) => const GetToKnow3Screen(),
        ),
        ShellRoute(
          builder: (context, state, child) => AppShell(child: child),
          routes: [
            GoRoute(
              path: '/discovery',
              builder: (_, _) => const DiscoveryScreen(),
            ),
            GoRoute(
              path: '/activities',
              builder: (_, _) => const Scaffold(body: Text('My Games')),
            ),
            GoRoute(
              path: '/create',
              builder: (_, _) => const Scaffold(body: Text('Create')),
            ),
            GoRoute(
              path: '/messages',
              builder: (_, _) => const Scaffold(body: Text('Chat')),
            ),
            GoRoute(
              path: '/profile',
              builder: (_, _) => const Scaffold(body: Text('Profile')),
            ),
          ],
        ),
      ],
    );

    final activityRepo = _MockActivityRepository();
    final notifRepo = _MockNotificationRepository();
    final userRepo = _MockUserRepository();
    when(
      () => activityRepo.feed(
        filter: any(named: 'filter'),
        forceRefresh: any(named: 'forceRefresh'),
      ),
    ).thenAnswer((_) async => [_activityFixture()]);
    when(
      () => notifRepo.all(),
    ).thenAnswer((_) async => const <AppNotification>[]);
    // GetToKnow3Screen._onNext() calls userRepositoryProvider.
    // updateProfile — mock it to succeed synchronously. (Previously this
    // used LocalUserRepository, which now throws NO_BACKEND since dummy
    // data was removed.)
    when(
      () => userRepo.updateProfile(
        dateOfBirth: any(named: 'dateOfBirth'),
        heightCm: any(named: 'heightCm'),
        weightKg: any(named: 'weightKg'),
      ),
    ).thenAnswer((_) async => UserModel(id: 'me', displayName: 'Test User'));
    // GTK1 saves the join reason with a different argument shape —
    // mocktail matches stubs by exact named-arg set, so both shapes
    // need stubs.
    when(
      () => userRepo.updateProfile(joinReason: any(named: 'joinReason')),
    ).thenAnswer((_) async => UserModel(id: 'me', displayName: 'Test User'));

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          activityRepositoryProvider.overrideWithValue(activityRepo),
          notificationRepositoryProvider.overrideWithValue(notifRepo),
          userRepositoryProvider.overrideWithValue(userRepo),
        ],
        child: MaterialApp.router(routerConfig: router),
      ),
    );
    await tester.pumpAndSettle();
  }

  /// Walks get-to-know-1 → 2 → 3 → tap "Complete Profile", landing on
  /// Discovery exactly the way a real first-run user would.
  Future<void> completeOnboarding(WidgetTester tester) async {
    // GTK1 requires an explicit reason choice (no pre-selected default).
    await tester.tap(find.text('Meet new sports partners'));
    await tester.pump();
    await tester.tap(find.text('Next'));
    await tester.pumpAndSettle();
    await tester.scrollUntilVisible(
      find.text('Skip for now'),
      200,
      scrollable: find.byType(Scrollable).first,
    );
    await tester.tap(find.text('Skip for now'));
    await tester.pumpAndSettle();
    // GTK3 carries valid defaults (height/weight/DOB prefilled), so
    // completing is one tap — no input needed.
    await tester.scrollUntilVisible(
      find.text('Complete Profile'),
      200,
      scrollable: find.byType(Scrollable).first,
    );
    await tester.tap(find.text('Complete Profile'));
    // updateProfile() + the tour's SharedPreferences.hasSeen() check are
    // both async — settle covers both before asserting on Discovery.
    await tester.pumpAndSettle();
  }

  setUpAll(() async {
    // GetToKnow3Screen._onNext() -> userRepositoryProvider reads
    // Env.useRemoteApi, which calls dotenv.maybeGet() — dotenv must be
    // loaded before that provider is ever read, or it throws and _onNext's
    // catch block silently swallows it, stranding the test on
    // get-to-know-3 instead of reaching Discovery.
    await dotenv.load(fileName: '.env.example');
  });

  setUp(() {
    SharedPreferences.setMockInitialValues({});
    // GTK3 reads SecureTokenStore (flutter_secure_storage channel has
    // no handler in tests — without this mock the await never resolves
    // and Complete stalls on "Saving…" forever).
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(
          const MethodChannel('plugins.it_nomads.com/flutter_secure_storage'),
          (call) async => null,
        );
    // NavGuard debounce state is static: without a reset, taps in one
    // test can swallow same-key pushes in the next (fake clocks restart
    // at the same epoch every test).
    NavGuard.resetForTest();
  });

  testWidgets(
    'should show the first-run tour after completing onboarding for the first time',
    (tester) async {
      // Uses the same setSurfaceSize convention as discovery_screen_test.dart
      // rather than tester.view: DiscoveryCard has a pre-existing overflow
      // at real narrow-phone MediaQuery widths (~390-430px) that is out of
      // scope for the tour work to fix. setSurfaceSize doesn't actually
      // change MediaQuery.size on this Flutter version (see
      // spotlight_overlay_test.dart's finding), which is exactly what
      // avoids triggering that overflow here, same as every other
      // Discovery-rendering test in this suite.
      await tester.binding.setSurfaceSize(const Size(430, 932));
      addTearDown(() => tester.binding.setSurfaceSize(null));

      await pumpRouter(tester);
      await completeOnboarding(tester);

      // "Find your next game" is Discovery's header subtitle — unique text
      // that confirms we landed there, unlike "Discover" which also
      // matches the tab-bar label.
      expect(find.text('Find your next game'), findsOneWidget);
      expect(find.text(kFirstRunTour.first.title), findsOneWidget);
      expect(find.text('1/${kFirstRunTour.length}'), findsOneWidget);
    },
  );

  testWidgets(
    'should not show the tour again once it has already been completed',
    (tester) async {
      await tester.binding.setSurfaceSize(const Size(430, 932));
      addTearDown(() => tester.binding.setSurfaceSize(null));

      // Simulate a returning user: the flag is already set before this
      // run even starts, exactly as PrefsTourStore.markSeen would have
      // left it from a prior session.
      SharedPreferences.setMockInitialValues({
        'tour_seen_v1_$kFirstRunTourId': true,
      });

      await pumpRouter(tester);
      await completeOnboarding(tester);

      expect(find.text('Find your next game'), findsOneWidget);
      expect(find.text(kFirstRunTour.first.title), findsNothing);
    },
  );

  testWidgets(
    'should mark the tour as seen and remove the overlay after Skip is tapped',
    (tester) async {
      await tester.binding.setSurfaceSize(const Size(430, 932));
      addTearDown(() => tester.binding.setSurfaceSize(null));

      await pumpRouter(tester);
      await completeOnboarding(tester);
      expect(find.text(kFirstRunTour.first.title), findsOneWidget);

      await tester.tap(find.text('Skip'));
      await tester.pumpAndSettle();

      expect(find.text(kFirstRunTour.first.title), findsNothing);

      final prefs = await SharedPreferences.getInstance();
      expect(prefs.getBool('tour_seen_v1_$kFirstRunTourId'), isTrue);
    },
  );

  testWidgets(
    'should advance to the next step and back to Discovery-only chrome '
    'once the tour is completed via Next',
    (tester) async {
      await tester.binding.setSurfaceSize(const Size(430, 932));
      addTearDown(() => tester.binding.setSurfaceSize(null));

      await pumpRouter(tester);
      await completeOnboarding(tester);
      expect(find.text(kFirstRunTour[0].title), findsOneWidget);

      await tester.tap(find.text('Next'));
      await tester.pumpAndSettle();
      expect(find.text(kFirstRunTour[1].title), findsOneWidget);
      expect(find.text('2/${kFirstRunTour.length}'), findsOneWidget);
    },
  );
}
