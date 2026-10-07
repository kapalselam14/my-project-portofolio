import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:mocktail/mocktail.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:matchup_mobile/core/providers/repository_providers.dart';
import 'package:matchup_mobile/features/activities/domain/activity_participant.dart';
import 'package:matchup_mobile/features/activities/presentation/past_activity_review_screen.dart';
import 'package:matchup_mobile/features/discovery/data/activity_repository.dart';
import 'package:matchup_mobile/features/discovery/domain/activity_model.dart';
import 'package:matchup_mobile/features/ratings/data/ratings_repository.dart';
import 'package:matchup_mobile/features/ratings/data/ratings_repository_impl.dart';
import 'package:matchup_mobile/features/ratings/domain/rating_models.dart';

class _MockActivityRepository extends Mock implements ActivityRepository {}

void main() {
  late _MockActivityRepository repo;

  setUp(() {
    repo = _MockActivityRepository();
    SharedPreferences.setMockInitialValues({});
  });

  ActivityModel activity() => ActivityModel(
    id: '4',
    title: 'Morning Beach Volleyball',
    sportType: 'Volleyball',
    description: '',
    location: 'Sunset Beach Court',
    distanceKm: 0.5,
    dateTime: DateTime(2026, 7, 26, 8),
    skillLevel: 'Intermediate',
    capacity: 8,
    participantCount: 4,
    hostName: 'Priya Shah',
  );

  List<ActivityParticipant> participants() => [
    ActivityParticipant(
      userId: 'p1',
      name: 'Freya Lindqvist',
      avatarAsset: 'sarah_c.png',
      skillLevel: 'Advanced',
      joinedAt: DateTime.now().subtract(const Duration(days: 5)),
      isOrganizer: true,
    ),
    ActivityParticipant(
      userId: 'p2',
      name: 'Bakari Osei',
      avatarAsset: 'mike_c.png',
      skillLevel: 'Intermediate',
      joinedAt: DateTime.now().subtract(const Duration(days: 4)),
      isOrganizer: false,
    ),
  ];

  Future<void> pumpScreen(
    WidgetTester tester, {
    bool pushed = false,
    RatingsRepository? ratingsOverride,
  }) async {
    await tester.binding.setSurfaceSize(const Size(600, 1400));
    addTearDown(() => tester.binding.setSurfaceSize(null));

    final router = GoRouter(
      initialLocation: '/activities',
      routes: [
        GoRoute(
          path: '/activities',
          builder: (_, _) => const Scaffold(body: Text('Activities')),
        ),
        GoRoute(
          path: '/past-activity/:id/review',
          builder: (_, state) =>
              PastActivityReviewScreen(activityId: state.pathParameters['id']!),
        ),
      ],
    );

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          activityRepositoryProvider.overrideWithValue(repo),
          // The screen reads this on submit; the default body needs Env
          // (.env) which is not loaded in tests, so inject the in-memory
          // flavour and exercise the real local submit path. Tests may
          // pass a pre-seeded instance (e.g. an already-rated activity).
          ratingsRepositoryProvider.overrideWithValue(
            ratingsOverride ?? LocalRatingsRepository(),
          ),
        ],
        child: MaterialApp.router(routerConfig: router),
      ),
    );
    await tester.pumpAndSettle();

    if (pushed) {
      router.push('/past-activity/4/review');
      await tester.pumpAndSettle();
    }
  }

  group('PastActivityReviewScreen', () {
    testWidgets(
      'should render real activity + participants, not the old hardcoded seed',
      (tester) async {
        when(() => repo.byId('4')).thenAnswer((_) async => activity());
        when(
          () => repo.participants('4'),
        ).thenAnswer((_) async => participants());

        await pumpScreen(tester, pushed: true);

        expect(find.text('Morning Beach Volleyball'), findsOneWidget);
        expect(find.text('Sunset Beach Court'), findsOneWidget);
        expect(find.text('Freya Lindqvist'), findsOneWidget);
        expect(find.text('Bakari Osei'), findsOneWidget);
        // Old hardcoded seed content must be gone.
        expect(find.text('Sarah Connor'), findsNothing);
        expect(find.text('James Wilson'), findsNothing);
      },
    );

    testWidgets(
      'cancelled games show the summary read-only with no review form',
      (tester) async {
        when(() => repo.byId('4')).thenAnswer(
          (_) async => activity().copyWith(lifecycleStatus: 'cancelled'),
        );
        when(
          () => repo.participants('4'),
        ).thenAnswer((_) async => participants());

        await pumpScreen(tester, pushed: true);

        expect(find.text('Past Activity'), findsOneWidget);
        expect(find.text('Morning Beach Volleyball'), findsOneWidget);
        expect(
          find.text('This game was cancelled, so there is nothing to review.'),
          findsOneWidget,
        );
        // No rating form, no submit.
        expect(find.text('Submit Review'), findsNothing);
        expect(find.text('Update Review'), findsNothing);
      },
    );

    testWidgets('should record a per-participant star rating', (tester) async {
      when(() => repo.byId('4')).thenAnswer((_) async => activity());
      when(
        () => repo.participants('4'),
      ).thenAnswer((_) async => participants());

      await pumpScreen(tester, pushed: true);

      final fifthForFreya = find.byWidgetPredicate(
        (w) =>
            w is Semantics &&
            w.properties.label == '5 stars for Freya Lindqvist',
      );
      expect(fifthForFreya, findsOneWidget);

      await tester.tap(fifthForFreya);
      await tester.pumpAndSettle();

      // All five mini stars in Freya's row are now filled; Bakari's row
      // is untouched (still outlined).
      expect(
        find.byWidgetPredicate(
          (w) => w is Icon && w.icon == Icons.star_rounded && w.size == 22,
        ),
        findsNWidgets(5),
      );
    });

    testWidgets('should update the star rating when a star is tapped', (
      tester,
    ) async {
      when(() => repo.byId('4')).thenAnswer((_) async => activity());
      when(
        () => repo.participants('4'),
      ).thenAnswer((_) async => participants());

      await pumpScreen(tester, pushed: true);

      // Activity starts at 4 stars: exactly one unfilled 36px star
      // (participant mini-stars are 22px, so they don't match).
      final unfilled = find.byWidgetPredicate(
        (w) => w is Icon && w.icon == Icons.star_border_rounded && w.size == 36,
      );
      expect(unfilled, findsOneWidget);
      await tester.tap(unfilled);
      await tester.pumpAndSettle();

      expect(unfilled, findsNothing);
      expect(
        find.byWidgetPredicate(
          (w) => w is Icon && w.icon == Icons.star_rounded && w.size == 36,
        ),
        findsNWidgets(5),
      );
    });

    testWidgets('should pop after tapping Submit Review', (tester) async {
      when(() => repo.byId('4')).thenAnswer((_) async => activity());
      when(
        () => repo.participants('4'),
      ).thenAnswer((_) async => participants());

      await pumpScreen(tester, pushed: true);
      // Submit requires stars>=1 AND (comment non-empty OR >=1
      // participant rated) — leave a comment so the button enables.
      await tester.enterText(
        find.byWidgetPredicate((w) => w is TextField && w.maxLength == 500),
        'Great game!',
      );
      await tester.pumpAndSettle();
      await tester.tap(find.text('Submit Review'));
      await tester.pumpAndSettle();

      expect(find.text('Activity Review'), findsNothing);
      expect(find.text('Activities'), findsOneWidget);
    });

    testWidgets('should show Update wording when already rated', (
      tester,
    ) async {
      when(() => repo.byId('4')).thenAnswer((_) async => activity());
      when(
        () => repo.participants('4'),
      ).thenAnswer((_) async => participants());

      // Pre-seed a previous submission through the same in-memory repo
      // the screen will read via the provider override below.
      // runAsync: the repo simulates 220ms network latency with a
      // real-timer delay, which would deadlock the fake-async test
      // clock if awaited directly before any pump.
      final ratings = LocalRatingsRepository();
      await tester.runAsync(
        () => ratings.submitActivityRating(
          ActivityRatingSubmission(
            activityId: '4',
            activitySportType: 'Volleyball',
            participants: const [],
          ),
        ),
      );

      await pumpScreen(tester, pushed: true, ratingsOverride: ratings);

      expect(find.text('Update Review'), findsOneWidget);
      expect(find.textContaining('already reviewed'), findsOneWidget);
      expect(find.text('Submit Review'), findsNothing);
    });

    testWidgets('should show Submit wording for a fresh review', (
      tester,
    ) async {
      when(() => repo.byId('4')).thenAnswer((_) async => activity());
      when(
        () => repo.participants('4'),
      ).thenAnswer((_) async => participants());

      await pumpScreen(tester, pushed: true);

      expect(find.text('Submit Review'), findsOneWidget);
      expect(find.textContaining('already reviewed'), findsNothing);
    });
  });
}
