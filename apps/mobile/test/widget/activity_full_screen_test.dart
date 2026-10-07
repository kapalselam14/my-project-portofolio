import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:mocktail/mocktail.dart';

import 'package:matchup_mobile/core/providers/repository_providers.dart';
import 'package:matchup_mobile/features/activities/presentation/activity_full_screen.dart';
import 'package:matchup_mobile/features/discovery/data/activity_repository.dart';
import 'package:matchup_mobile/features/discovery/domain/activity_model.dart';

class _MockActivityRepository extends Mock implements ActivityRepository {}

void main() {
  late _MockActivityRepository repo;

  setUp(() {
    repo = _MockActivityRepository();
  });

  ActivityModel fullActivity() => ActivityModel(
    id: '7',
    title: 'Midweek Futsal Showdown',
    sportType: 'Futsal',
    description: '',
    location: 'Riverside Sports Hall',
    distanceKm: 1.9,
    dateTime: DateTime(2026, 8, 26, 18, 30),
    skillLevel: 'Advanced',
    capacity: 10,
    participantCount: 10,
    hostName: 'Kofi Boateng',
  );

  ActivityModel similarActivity(String id) => ActivityModel(
    id: id,
    title: 'Futsal Pickup #$id',
    sportType: 'Futsal',
    description: '',
    location: 'Downtown Courts',
    distanceKm: 2.5,
    dateTime: DateTime(2026, 8, 27, 19),
    skillLevel: 'Intermediate',
    capacity: 10,
    participantCount: 4,
    hostName: 'Ravi Menon',
  );

  Future<void> pumpScreen(WidgetTester tester) async {
    await tester.binding.setSurfaceSize(const Size(430, 1400));
    addTearDown(() => tester.binding.setSurfaceSize(null));

    final router = GoRouter(
      initialLocation: '/activity/7/full',
      routes: [
        GoRoute(
          path: '/activity/:id/full',
          builder: (_, state) =>
              ActivityFullScreen(activityId: state.pathParameters['id']!),
        ),
        GoRoute(
          path: '/activity/:id',
          builder: (_, _) => const Scaffold(body: Text('Activity Detail')),
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

  group('ActivityFullScreen', () {
    testWidgets(
      'should render real activity data from the repository, not the old hardcoded seed',
      (tester) async {
        when(() => repo.byId('7')).thenAnswer((_) async => fullActivity());
        when(
          () => repo.search(sport: 'Futsal'),
        ).thenAnswer((_) async => [fullActivity(), similarActivity('8')]);

        await pumpScreen(tester);

        expect(find.text('Midweek Futsal Showdown'), findsOneWidget);
        expect(find.text('Riverside Sports Hall'), findsOneWidget);
        expect(find.text('10 / 10 spots'), findsOneWidget);
        expect(find.text('Similar activities nearby'), findsOneWidget);
        expect(find.text('Futsal Pickup #8'), findsOneWidget);
        // Old hardcoded seed content must be gone.
        expect(find.text('Sunset Basketball 5v5'), findsNothing);
        expect(find.text('Brooklyn Public Courts'), findsNothing);
      },
    );

    testWidgets(
      'should push activity detail when a similar activity row is tapped',
      (tester) async {
        when(() => repo.byId('7')).thenAnswer((_) async => fullActivity());
        when(
          () => repo.search(sport: 'Futsal'),
        ).thenAnswer((_) async => [fullActivity(), similarActivity('8')]);

        await pumpScreen(tester);
        await tester.tap(find.text('Futsal Pickup #8'));
        await tester.pumpAndSettle();

        expect(find.text('Activity Detail'), findsOneWidget);
      },
    );

    testWidgets('should hide the similar-activities section when none exist', (
      tester,
    ) async {
      when(() => repo.byId('7')).thenAnswer((_) async => fullActivity());
      when(
        () => repo.search(sport: 'Futsal'),
      ).thenAnswer((_) async => [fullActivity()]);

      await pumpScreen(tester);

      expect(find.text('Similar activities nearby'), findsNothing);
    });
  });
}
