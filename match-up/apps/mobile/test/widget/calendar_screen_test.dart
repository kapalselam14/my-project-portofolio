import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:mocktail/mocktail.dart';

import 'package:matchup_mobile/core/providers/repository_providers.dart';
import 'package:matchup_mobile/features/calendar/data/calendar_repository.dart';
import 'package:matchup_mobile/features/calendar/domain/calendar_event.dart';
import 'package:matchup_mobile/features/calendar/presentation/calendar_screen.dart';

class _MockCalendarRepository extends Mock implements CalendarRepository {}

void main() {
  late _MockCalendarRepository repo;

  setUp(() {
    repo = _MockCalendarRepository();
    registerFallbackValue(
      CalendarEvent(
        id: 'fallback',
        activityId: 'fallback',
        title: 'fallback',
        start: DateTime(2026),
        end: DateTime(2026),
        location: '',
      ),
    );
  });

  Future<void> pumpScreen(WidgetTester tester) async {
    await tester.binding.setSurfaceSize(const Size(430, 1200));
    addTearDown(() => tester.binding.setSurfaceSize(null));

    final router = GoRouter(
      initialLocation: '/calendar',
      routes: [
        GoRoute(path: '/calendar', builder: (_, _) => const CalendarScreen()),
        GoRoute(
          path: '/notifications',
          builder: (_, _) => const Scaffold(body: Text('Notifications')),
        ),
        GoRoute(
          path: '/joined-activity/:id',
          builder: (_, state) =>
              Scaffold(body: Text('Joined ${state.pathParameters['id']}')),
        ),
      ],
    );

    await tester.pumpWidget(
      ProviderScope(
        overrides: [calendarRepositoryProvider.overrideWithValue(repo)],
        child: MaterialApp.router(routerConfig: router),
      ),
    );
    await tester.pumpAndSettle();
  }

  group('CalendarScreen', () {
    testWidgets(
      'should render real upcoming events for today, not a hardcoded agenda',
      (tester) async {
        final today = DateTime.now();
        when(() => repo.upcoming()).thenAnswer(
          (_) async => [
            CalendarEvent(
              id: 'e1',
              activityId: '9',
              title: 'Evening Pickleball',
              start: DateTime(today.year, today.month, today.day, 18),
              end: DateTime(today.year, today.month, today.day, 20),
              location: 'Kowhai Recreation Centre',
            ),
          ],
        );

        await pumpScreen(tester);

        expect(find.text('Calendar'), findsOneWidget);
        expect(find.text('Evening Pickleball'), findsOneWidget);
        expect(find.text('Kowhai Recreation Centre'), findsOneWidget);
        // Old hardcoded seed content must be gone.
        expect(find.text('5v5 Basketball Run'), findsNothing);
        expect(find.text('Morning Yoga Session'), findsNothing);
      },
    );

    testWidgets('should show an empty message when there are no events today', (
      tester,
    ) async {
      when(() => repo.upcoming()).thenAnswer((_) async => []);

      await pumpScreen(tester);

      expect(find.text('No activities on this day'), findsOneWidget);
    });

    testWidgets(
      'should push joined-activity with the real activity id when an event card is tapped',
      (tester) async {
        final today = DateTime.now();
        when(() => repo.upcoming()).thenAnswer(
          (_) async => [
            CalendarEvent(
              id: 'e1',
              activityId: '9',
              title: 'Evening Pickleball',
              start: DateTime(today.year, today.month, today.day, 18),
              end: DateTime(today.year, today.month, today.day, 20),
              location: 'Kowhai Recreation Centre',
            ),
          ],
        );

        await pumpScreen(tester);
        await tester.tap(find.text('Evening Pickleball'));
        await tester.pumpAndSettle();

        expect(find.text('Joined 9'), findsOneWidget);
      },
    );

    testWidgets('should push notifications when the bell is tapped', (
      tester,
    ) async {
      when(() => repo.upcoming()).thenAnswer((_) async => []);

      await pumpScreen(tester);
      await tester.tap(find.byIcon(Icons.notifications_none));
      await tester.pumpAndSettle();

      expect(find.text('Notifications'), findsOneWidget);
    });

    testWidgets(
      'should sync an event to the device calendar with a success notice',
      (tester) async {
        final today = DateTime.now();
        when(() => repo.upcoming()).thenAnswer(
          (_) async => [
            CalendarEvent(
              id: 'e1',
              activityId: '9',
              title: 'Evening Pickleball',
              start: DateTime(today.year, today.month, today.day, 18),
              end: DateTime(today.year, today.month, today.day, 20),
              location: 'Kowhai Recreation Centre',
            ),
          ],
        );
        when(
          () => repo.addToDeviceCalendar(any()),
        ).thenAnswer((_) async => true);

        await pumpScreen(tester);
        await tester.tap(find.byTooltip('Sync ke kalender perangkat'));
        await tester.pumpAndSettle();

        verify(() => repo.addToDeviceCalendar(any())).called(1);
        expect(find.text('Added to your device calendar.'), findsOneWidget);
      },
    );

    testWidgets('should show an error notice when the device sync fails', (
      tester,
    ) async {
      final today = DateTime.now();
      when(() => repo.upcoming()).thenAnswer(
        (_) async => [
          CalendarEvent(
            id: 'e1',
            activityId: '9',
            title: 'Evening Pickleball',
            start: DateTime(today.year, today.month, today.day, 18),
            end: DateTime(today.year, today.month, today.day, 20),
            location: 'Kowhai Recreation Centre',
          ),
        ],
      );
      when(
        () => repo.addToDeviceCalendar(any()),
      ).thenAnswer((_) async => false);

      await pumpScreen(tester);
      await tester.tap(find.byTooltip('Sync ke kalender perangkat'));
      await tester.pumpAndSettle();

      expect(
        find.text('Could not add to your device calendar.'),
        findsOneWidget,
      );
    });
  });
}
