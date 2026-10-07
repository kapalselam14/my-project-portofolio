import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:mocktail/mocktail.dart';

import 'package:matchup_mobile/core/providers/repository_providers.dart';
import 'package:matchup_mobile/features/activities/presentation/edit_activity_screen.dart';
import 'package:matchup_mobile/features/discovery/data/activity_repository.dart';
import 'package:matchup_mobile/features/discovery/domain/activity_model.dart';

class _MockActivityRepository extends Mock implements ActivityRepository {}

ActivityModel _activity({bool isPaid = false, double? fee}) => ActivityModel(
  id: '9',
  title: 'Sunday Run',
  sportType: 'Running',
  description: 'Easy laps.',
  location: 'Auckland Domain',
  distanceKm: 1.2,
  dateTime: DateTime.now().add(const Duration(days: 2)),
  skillLevel: 'Beginner',
  capacity: 10,
  participantCount: 3,
  hostName: 'Sam',
  latitude: -36.8558,
  longitude: 174.7764,
  isPaid: isPaid,
  fee: fee,
);

void main() {
  late _MockActivityRepository repo;

  setUp(() {
    repo = _MockActivityRepository();
    when(() => repo.byId('9')).thenAnswer((_) async => _activity());
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

  Future<void> pumpScreen(WidgetTester tester) async {
    final router = GoRouter(
      initialLocation: '/',
      routes: [
        GoRoute(
          path: '/',
          builder: (context, _) => Scaffold(
            body: Center(
              child: TextButton(
                onPressed: () => context.push('/edit-activity/9'),
                child: const Text('Open edit'),
              ),
            ),
          ),
        ),
        GoRoute(
          path: '/edit-activity/:id',
          builder: (_, state) =>
              EditActivityScreen(activityId: state.pathParameters['id']!),
        ),
      ],
    );
    await tester.pumpWidget(
      ProviderScope(
        overrides: [activityRepositoryProvider.overrideWithValue(repo)],
        child: MaterialApp.router(routerConfig: router),
      ),
    );
    await tester.tap(find.text('Open edit'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 100));
    await tester.pump(const Duration(milliseconds: 100));
  }

  group('EditActivityScreen', () {
    testWidgets('should prefill fields from the activity', (tester) async {
      await pumpScreen(tester);

      expect(find.text('Sunday Run'), findsOneWidget);
      expect(find.text('Auckland Domain'), findsOneWidget);
      expect(find.text('Running'), findsOneWidget);
      expect(find.text('Save'), findsOneWidget);
    });

    testWidgets('should submit only the changed fields', (tester) async {
      await pumpScreen(tester);

      await tester.enterText(find.byType(TextField).first, 'Sunday Sprint');
      await tester.pump();
      await tester.tap(find.text('Save'));
      await tester.pumpAndSettle();

      // Diffed payload: only the title changed, everything else is null
      // (the repository skips nulls server-side).
      verify(
        () => repo.updateActivity(
          activityId: '9',
          title: 'Sunday Sprint',
          sportType: 'Running',
          description: 'Easy laps.',
          locationName: 'Auckland Domain',
          latitude: -36.8558,
          longitude: 174.7764,
          geohash: any(named: 'geohash'),
          startTime: any(named: 'startTime'),
          endTime: any(named: 'endTime'),
          skillLevel: 'Beginner',
          capacity: 10,
          joinPolicy: any(named: 'joinPolicy'),
          isPaid: false,
          fee: null,
        ),
      ).called(1);
      // Success pops back home (the manage screen confirms in prod).
      expect(find.text('Edit Activity'), findsNothing);
      expect(find.text('Open edit'), findsOneWidget);
    });

    testWidgets('should prefill and submit a paid activity with its fee', (
      tester,
    ) async {
      when(
        () => repo.byId('9'),
      ).thenAnswer((_) async => _activity(isPaid: true, fee: 5.0));
      await pumpScreen(tester);

      await tester.tap(find.text('Save Changes'));
      await tester.pumpAndSettle();

      verify(
        () => repo.updateActivity(
          activityId: '9',
          title: 'Sunday Run',
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
          isPaid: true,
          fee: 5.0,
        ),
      ).called(1);
      expect(find.text('Open edit'), findsOneWidget);
    });

    testWidgets('should switch free to paid with a new price', (tester) async {
      await pumpScreen(tester);

      // Entry fee cards live below the fold — ListView builds lazily.
      final scrollable = find.byType(Scrollable).first;
      await tester.scrollUntilVisible(
        find.text('Paid'),
        300,
        scrollable: scrollable,
      );
      await tester.tap(find.text('Paid'));
      await tester.pump();
      final priceField = find.byWidgetPredicate(
        (w) => w is TextField && w.decoration?.hintText == '0.00',
      );
      await tester.scrollUntilVisible(priceField, 100, scrollable: scrollable);
      await tester.enterText(priceField, '7.50');
      await tester.pump();
      await tester.tap(find.text('Save Changes'));
      await tester.pumpAndSettle();

      verify(
        () => repo.updateActivity(
          activityId: '9',
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
          isPaid: true,
          fee: 7.5,
        ),
      ).called(1);
    });

    testWidgets('should block paid save with an invalid price', (tester) async {
      await pumpScreen(tester);

      await tester.scrollUntilVisible(
        find.text('Paid'),
        300,
        scrollable: find.byType(Scrollable).first,
      );
      await tester.tap(find.text('Paid'));
      await tester.pump();
      await tester.tap(find.text('Save Changes'));
      await tester.pumpAndSettle();

      verifyNever(
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
      );
      expect(find.text('Please enter a valid price.'), findsOneWidget);
    });

    testWidgets('should block save with an empty title', (tester) async {
      await pumpScreen(tester);

      await tester.enterText(find.byType(TextField).first, '   ');
      await tester.pump();
      await tester.tap(find.text('Save'));
      await tester.pumpAndSettle();

      verifyNever(
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
      );
      expect(find.text('Please enter a title.'), findsOneWidget);
    });
  });
}
