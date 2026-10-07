import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:mocktail/mocktail.dart';

import 'package:matchup_mobile/core/providers/repository_providers.dart';
import 'package:matchup_mobile/features/activities/presentation/match_screen.dart';
import 'package:matchup_mobile/features/discovery/data/activity_repository.dart';
import 'package:matchup_mobile/features/discovery/domain/activity_model.dart';

class _MockActivityRepository extends Mock implements ActivityRepository {}

void main() {
  late _MockActivityRepository repo;

  setUp(() {
    repo = _MockActivityRepository();
  });

  ActivityModel matchedActivity() => ActivityModel(
    id: '11',
    title: 'Thursday Badminton Doubles',
    sportType: 'Badminton',
    description: '',
    location: 'Harbourview Sports Centre',
    distanceKm: 1.4,
    dateTime: DateTime(2026, 8, 27, 18),
    skillLevel: 'Intermediate',
    capacity: 8,
    participantCount: 5,
    hostName: 'Amara Chukwu',
  );

  Future<void> pumpScreen(WidgetTester tester) async {
    await tester.binding.setSurfaceSize(const Size(600, 1400));
    addTearDown(() => tester.binding.setSurfaceSize(null));

    final router = GoRouter(
      initialLocation: '/match/11',
      routes: [
        GoRoute(
          path: '/match/:id',
          builder: (_, state) =>
              MatchScreen(activityId: state.pathParameters['id']!),
        ),
        GoRoute(
          path: '/joined-activity/:id',
          builder: (_, _) => const Scaffold(body: Text('Joined Activity')),
        ),
        GoRoute(
          path: '/discovery',
          builder: (_, _) => const Scaffold(body: Text('Discovery')),
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

  group('MatchScreen', () {
    testWidgets(
      'should render real activity data from the repository, not the old hardcoded seed',
      (tester) async {
        when(() => repo.byId('11')).thenAnswer((_) async => matchedActivity());

        await pumpScreen(tester);

        expect(find.text("It's a Match!"), findsOneWidget);
        expect(find.text('Thursday Badminton Doubles'), findsOneWidget);
        expect(find.text('Harbourview Sports Centre'), findsOneWidget);
        expect(find.text('5 / 8 spots'), findsOneWidget);
        // Old hardcoded seed content must be gone.
        expect(find.text('Sunset Basketball 5v5'), findsNothing);
        expect(find.text('Brooklyn Public Courts'), findsNothing);
      },
    );

    testWidgets(
      'should go to joined-activity with the real activity id when View Activity Details is tapped',
      (tester) async {
        when(() => repo.byId('11')).thenAnswer((_) async => matchedActivity());

        await pumpScreen(tester);
        await tester.tap(find.text('View Activity Details'));
        await tester.pumpAndSettle();

        expect(find.text('Joined Activity'), findsOneWidget);
      },
    );

    testWidgets('should go to discovery when Keep Swiping is tapped', (
      tester,
    ) async {
      when(() => repo.byId('11')).thenAnswer((_) async => matchedActivity());

      await pumpScreen(tester);
      await tester.tap(find.text('Keep Swiping'));
      await tester.pumpAndSettle();

      expect(find.text('Discovery'), findsOneWidget);
    });
  });
}
