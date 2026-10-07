import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:mocktail/mocktail.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:matchup_mobile/core/network/api_client.dart';
import 'package:matchup_mobile/core/providers/repository_providers.dart';
import 'package:matchup_mobile/core/widgets/skeleton.dart';
import 'package:matchup_mobile/features/activities/domain/activity_model.dart';
import 'package:matchup_mobile/features/discovery/data/activity_repository.dart';
import 'package:matchup_mobile/features/discovery/data/swipes_repository.dart';
import 'package:matchup_mobile/features/discovery/domain/discovery_filter.dart';
import 'package:matchup_mobile/features/discovery/domain/swipe_decision.dart';
import 'package:matchup_mobile/features/discovery/presentation/discovery_screen.dart';
import 'package:matchup_mobile/features/discovery/presentation/widgets/discovery_card.dart';
import 'package:matchup_mobile/features/notifications/data/notification_repository.dart';
import 'package:matchup_mobile/features/notifications/domain/app_notification.dart';

class _MockActivityRepository extends Mock implements ActivityRepository {}

class _MockNotificationRepository extends Mock
    implements NotificationRepository {}

class _MockSwipesRepository extends Mock implements SwipesRepository {}

List<ActivityModel> _fixtures() => [
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
  ActivityModel(
    id: '2',
    title: 'Tennis Doubles',
    sportType: 'Tennis',
    description: 'Doubles match.',
    location: 'City Courts',
    distanceKm: 3.5,
    dateTime: DateTime.now().add(const Duration(days: 1)),
    skillLevel: 'Beginner',
    capacity: 4,
    participantCount: 2,
    hostName: 'Sam',
  ),
];

void main() {
  late _MockActivityRepository activityRepo;
  late _MockNotificationRepository notifRepo;
  late _MockSwipesRepository swipesRepo;

  setUpAll(() {
    // DiscoveryScreen restores the persisted filter via SharedPreferences
    // on mount — mock it so the store resolves immediately instead of
    // hanging (which would stall the first deck load past pumpAndSettle).
    SharedPreferences.setMockInitialValues({});
    // mocktail needs a fallback value for any non-primitive named
    // parameter — SwipeDecision is an enum, so a single enum value
    // works as a placeholder.
    registerFallbackValue(SwipeDecision.pass);
  });

  setUp(() {
    // Reset persisted prefs per test: filter writes persist via
    // SharedPreferences, and without this a filter applied in one test
    // would leak into the next test's seed-restore.
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
    ).thenAnswer((_) async => _fixtures());
    when(
      () => notifRepo.all(),
    ).thenAnswer((_) async => const <AppNotification>[]);
    // Swipes are fire-and-forget in the discovery screen — mock the
    // repository so the test doesn't try to hit the network through
    // the default RemoteSwipesRepository.
    when(
      () => swipesRepo.save(
        activityId: any(named: 'activityId'),
        decision: any(named: 'decision'),
      ),
    ).thenAnswer((_) async {});
    // Right-swipe on an open game joins for real (POST participants)
    // before opening the match screen — stub it so the deck doesn't
    // try to hit the network through RemoteActivityRepository.
    when(() => activityRepo.join(any())).thenAnswer((_) async {});
  });

  GoRouter buildRouter() {
    return GoRouter(
      initialLocation: '/discovery',
      routes: [
        GoRoute(path: '/discovery', builder: (_, _) => const DiscoveryScreen()),
        GoRoute(
          path: '/activity/:id',
          builder: (_, state) => Scaffold(
            body: Text('Activity Detail ${state.pathParameters['id']}'),
          ),
        ),
        GoRoute(
          path: '/filter',
          builder: (_, _) => const Scaffold(body: Text('Filters')),
        ),
        GoRoute(
          path: '/notifications',
          builder: (_, _) => const Scaffold(body: Text('Notifications')),
        ),
        GoRoute(
          path: '/request-sent/:id',
          builder: (_, state) =>
              Scaffold(body: Text('Pending ${state.pathParameters['id']}')),
        ),
        GoRoute(
          path: '/match/:id',
          builder: (_, _) => const Scaffold(body: Text('Match')),
        ),
      ],
    );
  }

  Future<GoRouter> pumpDiscovery(WidgetTester tester) async {
    // Discovery cards are laid out for a real phone frame — the default
    // 800×600 test surface is too short and the overlapping stacked cards
    // overflow their Column, which fails the test on an unrelated render
    // error before assertions even run.
    await tester.binding.setSurfaceSize(const Size(390, 844));
    addTearDown(() => tester.binding.setSurfaceSize(null));

    final router = buildRouter();

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
    return router;
  }

  group('DiscoveryScreen', () {
    testWidgets('should render the top activity title', (tester) async {
      await pumpDiscovery(tester);
      expect(find.text('Discover'), findsOneWidget);
      expect(find.text('Saturday Basketball'), findsOneWidget);
    });

    testWidgets('should never deal games that already started', (tester) async {
      // Stale `open` rows slip past the eventual backend sweep — the
      // deck must drop them locally, since the join would 409 anyway.
      when(
        () => activityRepo.feed(
          limit: any(named: 'limit'),
          offset: any(named: 'offset'),
          filter: any(named: 'filter'),
          forceRefresh: any(named: 'forceRefresh'),
        ),
      ).thenAnswer(
        (_) async => [
          ..._fixtures(),
          ActivityModel(
            id: '0',
            title: 'Yesterday Football',
            sportType: 'Football',
            description: 'Already kicked off.',
            location: 'Old Grounds',
            distanceKm: 1.0,
            dateTime: DateTime.now().subtract(const Duration(hours: 1)),
            skillLevel: 'Beginner',
            capacity: 10,
            participantCount: 3,
            hostName: 'Alex',
          ),
        ],
      );
      await pumpDiscovery(tester);
      expect(find.text('Saturday Basketball'), findsOneWidget);
      expect(find.text('Yesterday Football'), findsNothing);
    });

    testWidgets(
      'should push the activity detail route when the card is tapped',
      (tester) async {
        await pumpDiscovery(tester);
        await tester.tap(find.text('Saturday Basketball'));
        await tester.pumpAndSettle();
        expect(find.text('Activity Detail 1'), findsOneWidget);
      },
    );

    testWidgets('should navigate to filters when the filter icon is tapped', (
      tester,
    ) async {
      await pumpDiscovery(tester);
      await tester.tap(find.bySemanticsLabel('Filters'));
      await tester.pumpAndSettle();
      expect(find.text('Filters'), findsOneWidget);
    });

    testWidgets(
      'should advance to the next card when the join button is tapped',
      (tester) async {
        await pumpDiscovery(tester);
        expect(find.text('Saturday Basketball'), findsOneWidget);

        await tester.tap(find.bySemanticsLabel('Join game'));
        // The exit animation (~320ms) plays before the navigation Future
        // (420ms delay) fires — settle both.
        await tester.pumpAndSettle(const Duration(milliseconds: 600));

        expect(find.text('Match'), findsOneWidget);
      },
    );

    testWidgets('should show an empty state once the deck is exhausted', (
      tester,
    ) async {
      when(
        () => activityRepo.feed(
          limit: any(named: 'limit'),
          offset: any(named: 'offset'),
          filter: any(named: 'filter'),
          forceRefresh: any(named: 'forceRefresh'),
        ),
      ).thenAnswer((_) async => [_fixtures().first]);

      await pumpDiscovery(tester);

      await tester.tap(find.bySemanticsLabel('Not now'));
      await tester.pumpAndSettle();

      expect(find.text("You're all caught up"), findsOneWidget);
    });

    testWidgets('should re-deal swiped cards when Start over is tapped', (
      tester,
    ) async {
      // Every card arrives already swiped → the swipe filter empties
      // the deck on first load (regression: "Start over" used to only
      // rewind the index, a visible no-op on an empty list).
      final swiped = _fixtures()
          .map((a) => a.copyWith(mySwipeDecision: 'pass'))
          .toList();
      when(
        () => activityRepo.feed(
          limit: any(named: 'limit'),
          offset: any(named: 'offset'),
          filter: any(named: 'filter'),
          forceRefresh: any(named: 'forceRefresh'),
        ),
        // Small delay so the in-between loading frame is observable:
        // with an instant mock the reload resolves before the next
        // frame and the skeleton never paints.
      ).thenAnswer((_) async {
        await Future<void>.delayed(const Duration(milliseconds: 100));
        return swiped;
      });

      await pumpDiscovery(tester);
      expect(find.text("You're all caught up"), findsOneWidget);

      await tester.tap(find.text('Start over'));
      // Loading state first: the skeleton shows while the feed
      // reloads so the tap never looks dead on slow networks…
      await tester.pump();
      expect(find.byType(ActivityCardSkeleton), findsOneWidget);

      // …then the re-dealt deck.
      await tester.pumpAndSettle();
      expect(find.text('Saturday Basketball'), findsOneWidget);
    });

    testWidgets(
      'should keep the full deck after leaving and returning to Discover',
      (tester) async {
        // Regression: the "show swiped" choice lived in widget State,
        // which ShellRoute disposes on every tab switch — so returning
        // to Discover re-applied the filter and forced another
        // "Start over" tap. It now lives in a session provider.
        final swiped = _fixtures()
            .map((a) => a.copyWith(mySwipeDecision: 'pass'))
            .toList();
        when(
          () => activityRepo.feed(
            limit: any(named: 'limit'),
            offset: any(named: 'offset'),
            filter: any(named: 'filter'),
            forceRefresh: any(named: 'forceRefresh'),
          ),
        ).thenAnswer((_) async => swiped);

        await tester.binding.setSurfaceSize(const Size(390, 844));
        addTearDown(() => tester.binding.setSurfaceSize(null));

        final container = ProviderContainer(
          overrides: [
            activityRepositoryProvider.overrideWithValue(activityRepo),
            notificationRepositoryProvider.overrideWithValue(notifRepo),
            swipesRepositoryProvider.overrideWithValue(swipesRepo),
          ],
        );
        addTearDown(container.dispose);

        Future<void> mountFresh() async {
          await tester.pumpWidget(
            UncontrolledProviderScope(
              container: container,
              child: MaterialApp.router(routerConfig: buildRouter()),
            ),
          );
          await tester.pumpAndSettle();
        }

        // First mount: everything swiped → empty deck.
        await mountFresh();
        expect(find.text("You're all caught up"), findsOneWidget);

        // Start over → full deck back.
        await tester.tap(find.text('Start over'));
        await tester.pumpAndSettle();
        expect(find.text('Saturday Basketball'), findsOneWidget);

        // Simulate a tab switch: tear the whole tree down (disposing the
        // screen State, like ShellRoute does) and mount fresh with the
        // SAME provider container.
        await tester.pumpWidget(Container());
        await mountFresh();

        // No second "Start over" needed.
        expect(find.text('Saturday Basketball'), findsOneWidget);
        expect(find.text("You're all caught up"), findsNothing);
      },
    );

    testWidgets(
      'should forward includeSwiped on Start over with an active filter',
      (tester) async {
        // The server excludes swiped cards from `?discover=1` unless
        // told otherwise — without the flag, "Start over" would be a
        // no-op on a filtered deck (regression this covers). All
        // fixtures arrive swiped so the deck starts empty.
        final swiped = _fixtures()
            .map((a) => a.copyWith(mySwipeDecision: 'pass'))
            .toList();
        when(
          () => activityRepo.feed(
            limit: any(named: 'limit'),
            offset: any(named: 'offset'),
            filter: any(named: 'filter'),
            forceRefresh: any(named: 'forceRefresh'),
          ),
        ).thenAnswer((_) async => swiped);

        final filter = DiscoveryFilter(
          sportSkills: const [
            DiscoverySportSkill(
              sport: 'Basketball',
              skill: DiscoverySkillLevel.any,
            ),
          ],
        );

        await tester.pumpWidget(
          ProviderScope(
            overrides: [
              activityRepositoryProvider.overrideWithValue(activityRepo),
              notificationRepositoryProvider.overrideWithValue(notifRepo),
              swipesRepositoryProvider.overrideWithValue(swipesRepo),
              discoveryFilterProvider.overrideWith((_) => filter),
            ],
            child: MaterialApp.router(routerConfig: buildRouter()),
          ),
        );
        await tester.pumpAndSettle();
        // Filter is active so the empty deck names it (not the generic
        // "caught up" copy) and offers "Clear filters".
        expect(find.text('No matches for these filters'), findsOneWidget);
        expect(find.text('Clear filters'), findsOneWidget);

        await tester.tap(find.text('Start over'));
        await tester.pumpAndSettle();

        verify(
          () => activityRepo.feed(
            limit: any(named: 'limit'),
            offset: any(named: 'offset'),
            filter: filter.copyWith(includeSwiped: true),
            forceRefresh: any(named: 'forceRefresh'),
          ),
        ).called(1);
      },
    );

    testWidgets('should render no phantom cards behind the last deck card', (
      tester,
    ) async {
      // Regression: the peek layers used `.clamp()`, aliasing them to
      // the top card itself on the final index — swiping the last card
      // away revealed a ghost copy behind it. With one activity the
      // deck must render exactly one card.
      when(
        () => activityRepo.feed(
          limit: any(named: 'limit'),
          offset: any(named: 'offset'),
          filter: any(named: 'filter'),
          forceRefresh: any(named: 'forceRefresh'),
        ),
      ).thenAnswer((_) async => [_fixtures().first]);

      await pumpDiscovery(tester);

      expect(find.byType(DiscoveryCard), findsOneWidget);
    });

    testWidgets('should never re-deal right-swiped cards, even on Start over', (
      tester,
    ) async {
      // A right-swipe (join) is permanent: the game lives on in My
      // Games, so "Start over" must not resurrect it — only passes
      // come back.
      final joined = _fixtures()
          .map((a) => a.copyWith(mySwipeDecision: 'join'))
          .toList();
      when(
        () => activityRepo.feed(
          limit: any(named: 'limit'),
          offset: any(named: 'offset'),
          filter: any(named: 'filter'),
          forceRefresh: any(named: 'forceRefresh'),
        ),
      ).thenAnswer((_) async => joined);

      await pumpDiscovery(tester);
      expect(find.text("You're all caught up"), findsOneWidget);

      await tester.tap(find.text('Start over'));
      await tester.pumpAndSettle();

      // Still empty — joins never re-enter the deck.
      expect(find.text("You're all caught up"), findsOneWidget);
      expect(find.text('Saturday Basketball'), findsNothing);
    });

    testWidgets('should never deal activities the viewer hosts', (
      tester,
    ) async {
      // Regression: the legacy feed path didn't drop hosted games
      // client-side, so a host could see (and "join") their own card.
      when(
        () => activityRepo.feed(
          limit: any(named: 'limit'),
          offset: any(named: 'offset'),
          filter: any(named: 'filter'),
          forceRefresh: any(named: 'forceRefresh'),
        ),
      ).thenAnswer(
        (_) async => [
          _fixtures().first.copyWith(isHost: true, mySwipeDecision: null),
          _fixtures().last.copyWith(isHost: false, mySwipeDecision: null),
        ],
      );

      await pumpDiscovery(tester);

      expect(find.text('Saturday Basketball'), findsNothing);
      expect(find.text('Tennis Doubles'), findsOneWidget);
    });

    testWidgets('should hide cards clashing with already-joined games', (
      tester,
    ) async {
      // My Game runs [base+2h, base+4h]. The 3pm tennis overlaps and
      // must be hidden; the evening run does not and must stay. The
      // joined game itself is hidden too — it lives in My Games,
      // never in the Discover deck.
      final base = DateTime.now();
      ActivityModel game({
        required String id,
        required String title,
        required Duration startsIn,
        bool mine = false,
      }) => ActivityModel(
        id: id,
        title: title,
        sportType: 'Tennis',
        description: 'd',
        location: 'l',
        distanceKm: 1.0,
        dateTime: base.add(startsIn),
        skillLevel: 'Beginner',
        capacity: 4,
        participantCount: 2,
        hostName: 'Sam',
        isParticipant: mine,
      );
      when(
        () => activityRepo.feed(
          limit: any(named: 'limit'),
          offset: any(named: 'offset'),
          filter: any(named: 'filter'),
          forceRefresh: any(named: 'forceRefresh'),
        ),
      ).thenAnswer(
        (_) async => [
          game(
            id: 'm',
            title: 'My Game',
            startsIn: const Duration(hours: 2),
            mine: true,
          ),
          game(
            id: 'c',
            title: 'Clash Tennis',
            startsIn: const Duration(hours: 3),
          ),
          game(id: 'l', title: 'Late Run', startsIn: const Duration(hours: 6)),
        ],
      );

      await pumpDiscovery(tester);

      expect(find.text('My Game'), findsNothing);
      expect(find.text('Late Run'), findsOneWidget);
      expect(find.text('Clash Tennis'), findsNothing);
    });

    testWidgets('should reload when discoveryFilterProvider changes', (
      tester,
    ) async {
      // Default-empty filter loads once; the first call from
      // setUp is the empty filter path. After the screen settles,
      // writing a new filter should trigger a second call with
      // the new shape — that's the wiring FilterScreen relies on.
      await pumpDiscovery(tester);
      verify(
        () => activityRepo.feed(
          limit: any(named: 'limit'),
          offset: any(named: 'offset'),
          filter: any(named: 'filter'),
          forceRefresh: any(named: 'forceRefresh'),
        ),
      ).called(1);

      final newFilter = DiscoveryFilter(
        sportSkills: const [
          DiscoverySportSkill(
            sport: 'Basketball',
            skill: DiscoverySkillLevel.intermediate,
          ),
        ],
        maxDistanceKm: 5,
      );
      final container = ProviderScope.containerOf(
        tester.element(find.byType(DiscoveryScreen)),
      );
      container.read(discoveryFilterProvider.notifier).state = newFilter;
      await tester.pumpAndSettle();

      verify(
        () => activityRepo.feed(
          limit: any(named: 'limit'),
          offset: any(named: 'offset'),
          filter: newFilter,
          forceRefresh: any(named: 'forceRefresh'),
        ),
      ).called(1);
    });

    testWidgets(
      'should show the skeleton while reloading after a filter change',
      (tester) async {
        // Regression: applying a filter left the stale deck frozen on
        // screen with zero feedback until the new feed arrived. Slow the
        // reload down so the in-between loading frame is observable.
        await pumpDiscovery(tester);
        expect(find.text('Saturday Basketball'), findsOneWidget);

        when(
          () => activityRepo.feed(
            limit: any(named: 'limit'),
            offset: any(named: 'offset'),
            filter: any(named: 'filter'),
            forceRefresh: any(named: 'forceRefresh'),
          ),
        ).thenAnswer((_) async {
          await Future<void>.delayed(const Duration(milliseconds: 100));
          return _fixtures();
        });

        final container = ProviderScope.containerOf(
          tester.element(find.byType(DiscoveryScreen)),
        );
        container
            .read(discoveryFilterProvider.notifier)
            .state = const DiscoveryFilter(
          sportSkills: [
            DiscoverySportSkill(
              sport: 'Basketball',
              skill: DiscoverySkillLevel.any,
            ),
          ],
        );
        await tester.pump();
        expect(find.byType(ActivityCardSkeleton), findsOneWidget);

        await tester.pumpAndSettle();
        expect(find.text('Saturday Basketball'), findsOneWidget);
      },
    );

    testWidgets(
      'should pass the active discoveryFilterProvider to feed() when reloading',
      (tester) async {
        // Wrap the screen in a ProviderScope whose initial value for
        // the filter is already non-empty. The discovery screen reads
        // the filter synchronously inside _load() so the mocked feed()
        // call captures the right shape.
        final filter = DiscoveryFilter(
          sportSkills: const [
            DiscoverySportSkill(
              sport: 'Basketball',
              skill: DiscoverySkillLevel.intermediate,
            ),
          ],
          maxDistanceKm: 5,
        );

        await tester.pumpWidget(
          ProviderScope(
            overrides: [
              activityRepositoryProvider.overrideWithValue(activityRepo),
              notificationRepositoryProvider.overrideWithValue(notifRepo),
              swipesRepositoryProvider.overrideWithValue(swipesRepo),
              // Pre-seed the filter so the very first _load() reads it.
              discoveryFilterProvider.overrideWith((_) => filter),
            ],
            child: MaterialApp.router(routerConfig: buildRouter()),
          ),
        );
        await tester.pumpAndSettle();

        verify(
          () => activityRepo.feed(
            limit: any(named: 'limit'),
            offset: any(named: 'offset'),
            filter: filter,
            forceRefresh: any(named: 'forceRefresh'),
          ),
        ).called(1);
      },
    );

    testWidgets('should distinguish instant-join from approval games', (
      tester,
    ) async {
      // First card open (default policy), second needs approval.
      when(
        () => activityRepo.feed(
          limit: any(named: 'limit'),
          offset: any(named: 'offset'),
          filter: any(named: 'filter'),
          forceRefresh: any(named: 'forceRefresh'),
        ),
      ).thenAnswer(
        (_) async => [
          _fixtures().first,
          _fixtures().last.copyWith(joinPolicy: 'approval'),
        ],
      );

      await pumpDiscovery(tester);

      // Pills for both stacked cards exist; the action row follows
      // the top card (open): Join, not Request.
      expect(find.text('INSTANT JOIN'), findsWidgets);
      expect(find.text('NEEDS APPROVAL'), findsWidgets);
      expect(find.bySemanticsLabel('Join game'), findsOneWidget);
      expect(find.bySemanticsLabel('Request'), findsNothing);

      // Pass the open card (left swipe stays on deck, unlike join
      // which navigates to Match): the row flips to Request.
      await tester.tap(find.bySemanticsLabel('Not now'));
      await tester.pumpAndSettle(const Duration(milliseconds: 600));

      expect(find.bySemanticsLabel('Request'), findsOneWidget);
      expect(find.bySemanticsLabel('Join game'), findsNothing);
    });

    testWidgets('should request join and open pending on approval swipe', (
      tester,
    ) async {
      when(() => activityRepo.requestJoin(any())).thenAnswer((_) async {});
      when(
        () => activityRepo.feed(
          limit: any(named: 'limit'),
          offset: any(named: 'offset'),
          filter: any(named: 'filter'),
          forceRefresh: any(named: 'forceRefresh'),
        ),
      ).thenAnswer(
        (_) async => [_fixtures().first.copyWith(joinPolicy: 'approval')],
      );

      await pumpDiscovery(tester);

      // Request button (not Join) for the approval card.
      await tester.tap(find.bySemanticsLabel('Request'));
      await tester.pumpAndSettle();

      verify(() => activityRepo.requestJoin('1')).called(1);
      expect(find.text('Pending 1'), findsOneWidget);
      expect(find.text('Match'), findsNothing);
    });

    testWidgets('should open pending when the request already exists', (
      tester,
    ) async {
      // Backend rejects duplicates with 409 + the exact pending message
      // (mirrors _ErrorInterceptor output: ApiException in error).
      when(() => activityRepo.requestJoin(any())).thenThrow(
        DioException(
          requestOptions: RequestOptions(path: '/activities/1/join-requests'),
          response: Response(
            requestOptions: RequestOptions(path: '/activities/1/join-requests'),
            statusCode: 409,
            data: const {
              'ok': false,
              'error': {
                'code': 'CONFLICT',
                'message': 'Join request already pending',
              },
            },
          ),
          type: DioExceptionType.badResponse,
          error: const ApiException(
            statusCode: 409,
            userMessage: 'Join request already pending',
            code: 'CONFLICT',
          ),
        ),
      );
      when(
        () => activityRepo.feed(
          limit: any(named: 'limit'),
          offset: any(named: 'offset'),
          filter: any(named: 'filter'),
          forceRefresh: any(named: 'forceRefresh'),
        ),
      ).thenAnswer(
        (_) async => [_fixtures().first.copyWith(joinPolicy: 'approval')],
      );

      await pumpDiscovery(tester);

      await tester.tap(find.bySemanticsLabel('Request'));
      await tester.pumpAndSettle();

      // No error claimed — she is already queued, so the pending
      // screen is shown and the swipe is recorded.
      verify(() => activityRepo.requestJoin('1')).called(1);
      expect(find.text('Pending 1'), findsOneWidget);
      expect(
        find.text('Could not send the request. Please try again.'),
        findsNothing,
      );
      verify(
        () => swipesRepo.save(activityId: '1', decision: SwipeDecision.join),
      ).called(1);
    });

    testWidgets('should force-refresh the deck when Refresh is tapped', (
      tester,
    ) async {
      await pumpDiscovery(tester);

      // Deck rendered from the initial load.
      expect(find.text('Saturday Basketball'), findsOneWidget);

      await tester.tap(find.bySemanticsLabel('Refresh'));
      await tester.pumpAndSettle();

      // Initial load (forceRefresh: false) + manual refresh (true).
      verify(
        () => activityRepo.feed(
          limit: any(named: 'limit'),
          offset: any(named: 'offset'),
          filter: any(named: 'filter'),
          forceRefresh: false,
        ),
      ).called(1);
      verify(
        () => activityRepo.feed(
          limit: any(named: 'limit'),
          offset: any(named: 'offset'),
          filter: any(named: 'filter'),
          forceRefresh: true,
        ),
      ).called(1);
      // Deck still renders after the refresh round-trip.
      expect(find.text('Saturday Basketball'), findsOneWidget);
    });
  });
}
