import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:mocktail/mocktail.dart';

import 'package:matchup_mobile/core/providers/repository_providers.dart';
import 'package:matchup_mobile/features/activities/domain/activity_model.dart';
import 'package:matchup_mobile/features/activities/domain/activity_participant.dart';
import 'package:matchup_mobile/features/discovery/data/activity_repository.dart';
import 'package:matchup_mobile/features/discovery/presentation/activity_detail_screen.dart';
import 'package:matchup_mobile/core/utils/nav_guard.dart';

/// Reproduces the user-reported bug: "tombol-tombol nya gabisa dipencet,
/// semuanya" (none of the buttons on the activity detail screen are
/// tappable). These tests actually pump the widget tree and tap each
/// button rather than just reading the source, so a hit-testing regression
/// (e.g. a widget silently absorbing taps) shows up as a failing test.
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

ActivityModel _approvalFixture({String? joinRequestStatus}) => ActivityModel(
  id: 'a-2',
  title: 'Sunday Tennis Approval',
  sportType: 'Tennis',
  description: 'Host-approved session.',
  location: 'Domain Courts',
  distanceKm: 1.2,
  dateTime: DateTime(2027, 8, 23, 10),
  skillLevel: 'Beginner',
  capacity: 4,
  participantCount: 1,
  hostName: 'Sarah Chen',
  joinPolicy: 'approval',
  joinRequestStatus: joinRequestStatus,
);

void main() {
  late _MockActivityRepository repo;

  setUp(() {
    NavGuard.resetForTest();
    repo = _MockActivityRepository();
    when(() => repo.byId(any())).thenAnswer((_) async => _fixture());
    when(() => repo.join(any())).thenAnswer((_) async {});
    // The participant stack reads the live roster — default to empty so
    // tests never touch the network.
    when(
      () => repo.participants(any()),
    ).thenAnswer((_) async => <ActivityParticipant>[]);
  });

  /// Builds a router that starts on a "Home" screen and only reaches the
  /// detail screen via a real navigation action — [via]. This is what
  /// actually distinguishes the bug: `context.go('/activity/:id')` replaces
  /// the whole stack (nothing left to pop back to), while
  /// `context.push('/activity/:id')` layers it on top (back/dislike can pop
  /// back to Home). A router built with `initialLocation: '/activity/a-1'`
  /// can't tell these apart because there's no prior route either way —
  /// that gap is why the previous version of this test passed despite the
  /// button being effectively dead on the real navigation path.
  Future<GoRouter> pumpViaRealNavigation(
    WidgetTester tester, {
    required ActivityRepository repo,
    required void Function(BuildContext) via,
  }) async {
    final router = GoRouter(
      initialLocation: '/home',
      routes: [
        GoRoute(
          path: '/home',
          builder: (context, _) => Scaffold(
            body: Center(
              child: TextButton(
                onPressed: () => via(context),
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
          path: '/discovery',
          builder: (_, _) =>
              const Scaffold(body: Center(child: Text('Discovery'))),
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
    );

    await tester.pumpWidget(
      ProviderScope(
        overrides: [activityRepositoryProvider.overrideWithValue(repo)],
        child: MaterialApp.router(routerConfig: router),
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.text('Open Activity'));
    await tester.pumpAndSettle();
    expect(find.byType(ActivityDetailScreen), findsOneWidget);

    return router;
  }

  group('ActivityDetailScreen buttons', () {
    testWidgets(
      'back button actually returns to the previous screen when reached via push',
      (tester) async {
        await pumpViaRealNavigation(
          tester,
          repo: repo,
          via: (context) => context.push('/activity/a-1'),
        );

        await tester.tap(find.bySemanticsLabel('Back'));
        await tester.pumpAndSettle();

        expect(
          find.text('Open Activity'),
          findsOneWidget,
          reason: 'Back button did not return to the previous screen',
        );
      },
    );

    testWidgets('back button falls back to discovery when reached via go() '
        '(regression: "tombol back gabisa dipencet")', (tester) async {
      await pumpViaRealNavigation(
        tester,
        repo: repo,
        via: (context) => context.go('/activity/a-1'),
      );

      await tester.tap(find.bySemanticsLabel('Back'));
      await tester.pumpAndSettle();

      // go() wipes the stack, so there is nothing to pop — the button
      // must fall back to Discover instead of dead-tapping.
      expect(find.text('Discovery'), findsOneWidget);
      expect(find.byType(ActivityDetailScreen), findsNothing);
    });

    testWidgets('host card opens the host profile when tapped', (tester) async {
      when(
        () => repo.byId(any()),
      ).thenAnswer((_) async => _fixture().copyWith(hostId: 'host-1'));

      await pumpViaRealNavigation(
        tester,
        repo: repo,
        via: (context) => context.push('/activity/a-1'),
      );

      await tester.tap(find.text('James Wilson'));
      await tester.pumpAndSettle();

      expect(find.text('Host profile host-1'), findsOneWidget);
    });

    testWidgets('rapid taps on the host card never duplicate the profile page '
        '(regression: keyReservation red screen)', (tester) async {
      when(
        () => repo.byId(any()),
      ).thenAnswer((_) async => _fixture().copyWith(hostId: 'host-1'));

      await pumpViaRealNavigation(
        tester,
        repo: repo,
        via: (context) => context.push('/activity/a-1'),
      );

      // Three taps with no settling between them: without the
      // in-flight guard the second push would create a duplicate
      // `player-profile-uid-host-1` page and red-screen.
      await tester.tap(find.text('James Wilson'));
      await tester.pump(const Duration(milliseconds: 50));
      await tester.tap(find.text('James Wilson'));
      await tester.pump(const Duration(milliseconds: 50));
      await tester.tap(find.text('James Wilson'));
      await tester.pumpAndSettle();

      expect(find.text('Host profile host-1'), findsOneWidget);
      expect(tester.takeException(), isNull);
    });

    testWidgets(
      'dislike (X) button actually returns to the previous screen when reached via push',
      (tester) async {
        await pumpViaRealNavigation(
          tester,
          repo: repo,
          via: (context) => context.push('/activity/a-1'),
        );

        await tester.tap(find.bySemanticsLabel('Not interested'));
        await tester.pumpAndSettle();

        expect(
          find.text('Open Activity'),
          findsOneWidget,
          reason: 'Dislike button did not return to the previous screen',
        );
      },
    );

    testWidgets('join (heart) button calls repository.join when tapped', (
      tester,
    ) async {
      await pumpViaRealNavigation(
        tester,
        repo: repo,
        via: (context) => context.push('/activity/a-1'),
      );

      // NOTE: find.bySemanticsLabel('Join Game') finds 0 nodes here even
      // though the Semantics widget exists — the label merges with the
      // 'Join Game' text child in the semantics tree. Match the Text instead.
      final joinButton = find.text('Join Game');
      expect(
        joinButton,
        findsOneWidget,
        reason: 'Join button not found in tree',
      );

      await tester.ensureVisible(joinButton);
      await tester.tap(joinButton);
      await tester.pump(); // start the async join
      await tester.pumpAndSettle();

      verify(() => repo.join('a-1')).called(1);
    });

    testWidgets(
      'approval activity shows Request to Join and files a request on tap',
      (tester) async {
        when(
          () => repo.byId(any()),
        ).thenAnswer((_) async => _approvalFixture());
        when(() => repo.requestJoin(any())).thenAnswer((_) async {});

        await pumpViaRealNavigation(
          tester,
          repo: repo,
          via: (context) => context.push('/activity/a-2'),
        );

        final requestButton = find.text('Request to Join');
        expect(requestButton, findsOneWidget);

        await tester.ensureVisible(requestButton);
        await tester.tap(requestButton);
        await tester.pump(); // start the async request
        await tester.pumpAndSettle();

        verify(() => repo.requestJoin('a-2')).called(1);
        expect(find.text('Request pending'), findsOneWidget);
      },
    );

    testWidgets('started activity disables join with Already started label', (
      tester,
    ) async {
      // Backdate the fixture past its start time.
      when(() => repo.byId(any())).thenAnswer(
        (_) async => ActivityModel(
          id: 'a-1',
          title: 'Saturday Afternoon 5v5 Basketball',
          sportType: 'Basketball',
          description: 'Looking for intermediate players.',
          location: 'Central Park Court B',
          distanceKm: 2.4,
          dateTime: DateTime.now().subtract(const Duration(hours: 1)),
          skillLevel: 'Intermediate',
          capacity: 10,
          participantCount: 6,
          hostName: 'James Wilson',
        ),
      );

      await pumpViaRealNavigation(
        tester,
        repo: repo,
        via: (context) => context.push('/activity/a-1'),
      );

      expect(find.text('Already started'), findsOneWidget);
      verifyNever(() => repo.join(any()));
    });

    testWidgets('approval activity shows waiting count under participants', (
      tester,
    ) async {
      when(() => repo.byId(any())).thenAnswer(
        (_) async => _approvalFixture().copyWith(pendingRequestCount: 3),
      );

      await pumpViaRealNavigation(
        tester,
        repo: repo,
        via: (context) => context.push('/activity/a-2'),
      );

      expect(find.text('3 waiting for approval'), findsOneWidget);
    });

    testWidgets(
      'pending request renders a disabled pill and never calls requestJoin',
      (tester) async {
        when(() => repo.byId(any())).thenAnswer(
          (_) async => _approvalFixture(joinRequestStatus: 'pending'),
        );
        when(() => repo.requestJoin(any())).thenAnswer((_) async {});

        await pumpViaRealNavigation(
          tester,
          repo: repo,
          via: (context) => context.push('/activity/a-2'),
        );

        expect(find.text('Request pending'), findsOneWidget);
        // Disabled pill: tapping must not file anything.
        await tester.tap(find.text('Request pending'));
        await tester.pumpAndSettle();

        verifyNever(() => repo.requestJoin(any()));
      },
    );

    testWidgets('report button opens the report bottom sheet when tapped', (
      tester,
    ) async {
      final router = GoRouter(
        initialLocation: '/activity/a-1',
        routes: [
          GoRoute(
            path: '/activity/:id',
            builder: (_, state) =>
                ActivityDetailScreen(activityId: state.pathParameters['id']!),
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

      final reportButton = find.text('Report Activity');
      expect(reportButton, findsOneWidget);

      await tester.ensureVisible(reportButton);
      await tester.tap(reportButton);
      await tester.pumpAndSettle();

      // Reporting is a modal bottom sheet now (not a pushed route):
      // the sheet header + reason list + submit bar appear on top of the
      // still-visible detail screen.
      expect(find.text("What's the issue?"), findsOneWidget);
      expect(find.text('Submit Report'), findsOneWidget);
    });
  });
}
