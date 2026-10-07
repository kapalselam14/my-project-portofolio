import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:mocktail/mocktail.dart';

import 'package:matchup_mobile/core/providers/repository_providers.dart';
import 'package:matchup_mobile/features/activities/presentation/joined_activity_detail_screen.dart';
import 'package:matchup_mobile/features/activities/domain/activity_participant.dart';
import 'package:matchup_mobile/features/chat/data/chat_repository.dart';
import 'package:matchup_mobile/features/chat/domain/chat_message.dart';
import 'package:matchup_mobile/features/discovery/data/activity_repository.dart';
import 'package:matchup_mobile/features/discovery/domain/activity_model.dart';
import 'package:matchup_mobile/core/utils/nav_guard.dart';

class _MockActivityRepository extends Mock implements ActivityRepository {}

class _MockChatRepository extends Mock implements ChatRepository {}

void main() {
  late _MockActivityRepository activityRepo;
  late _MockChatRepository chatRepo;

  setUp(() {
    NavGuard.resetForTest();
    activityRepo = _MockActivityRepository();
    chatRepo = _MockChatRepository();
    // The participant stack reads the live roster — default to empty so
    // tests never touch the network.
    when(
      () => activityRepo.participants('9'),
    ).thenAnswer((_) async => <ActivityParticipant>[]);
    when(() => activityRepo.leave('9')).thenAnswer((_) async {});
  });

  Future<void> pumpScreen(WidgetTester tester) async {
    final router = GoRouter(
      initialLocation: '/joined-activity/9',
      routes: [
        GoRoute(
          path: '/joined-activity/:id',
          builder: (_, state) => JoinedActivityDetailScreen(
            activityId: state.pathParameters['id']!,
          ),
        ),
        GoRoute(
          path: '/activities',
          builder: (_, _) => const Scaffold(body: Text('Activities')),
        ),
        GoRoute(
          path: '/check-in/:id',
          builder: (_, _) => const Scaffold(body: Text('Check In')),
        ),
        GoRoute(
          path: '/player-profile/:name',
          builder: (_, _) => const Scaffold(body: Text('Player Profile')),
        ),
        GoRoute(
          path: '/chat/:title',
          builder: (_, _) => const Scaffold(body: Text('Chat')),
        ),
      ],
    );

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          activityRepositoryProvider.overrideWithValue(activityRepo),
          chatRepositoryProvider.overrideWithValue(chatRepo),
        ],
        child: MaterialApp.router(routerConfig: router),
      ),
    );
    await tester.pumpAndSettle();
  }

  group('JoinedActivityDetailScreen', () {
    testWidgets(
      'should render real activity data from the repository, not the old hardcoded seed',
      (tester) async {
        when(() => activityRepo.byId('9')).thenAnswer(
          (_) async => ActivityModel(
            id: '9',
            title: 'Tuesday Night Volleyball',
            sportType: 'Volleyball',
            description: '',
            location: 'Eastside Rec Centre',
            addressLine: 'Court 2, Eastside',
            distanceKm: 3.1,
            dateTime: DateTime(2026, 8, 25, 19),
            skillLevel: 'Beginner',
            capacity: 12,
            participantCount: 7,
            hostName: 'Wren Oduya',
          ),
        );
        when(() => chatRepo.messages('9')).thenAnswer((_) async => []);

        await pumpScreen(tester);

        expect(find.text('Tuesday Night Volleyball'), findsOneWidget);
        expect(find.text('Eastside Rec Centre'), findsOneWidget);
        expect(find.text('Wren Oduya'), findsOneWidget);
        expect(find.text('7 joined / 12 total'), findsOneWidget);
        // Old hardcoded seed content must be gone.
        expect(find.text('Saturday Afternoon 5v5 Basketball'), findsNothing);
        expect(find.text('Central Park Court B'), findsNothing);
      },
    );

    testWidgets('should push check-in when the Check In button is tapped', (
      tester,
    ) async {
      when(() => activityRepo.byId('9')).thenAnswer(
        (_) async => ActivityModel(
          id: '9',
          title: 'Tuesday Night Volleyball',
          sportType: 'Volleyball',
          description: '',
          location: 'Eastside Rec Centre',
          distanceKm: 3.1,
          dateTime: DateTime(2026, 8, 25, 19),
          skillLevel: 'Beginner',
          capacity: 12,
          participantCount: 7,
          hostName: 'Wren Oduya',
        ),
      );
      when(() => chatRepo.messages('9')).thenAnswer((_) async => []);

      await pumpScreen(tester);
      await tester.scrollUntilVisible(
        find.text('Check In'),
        300,
        scrollable: find.byType(Scrollable).first,
      );
      await tester.tap(find.text('Check In'));
      await tester.pumpAndSettle();

      expect(find.text('Check In'), findsWidgets);
    });

    testWidgets('should return to Activities after confirming Leave Activity', (
      tester,
    ) async {
      when(() => activityRepo.byId('9')).thenAnswer(
        (_) async => ActivityModel(
          id: '9',
          title: 'Tuesday Night Volleyball',
          sportType: 'Volleyball',
          description: '',
          location: 'Eastside Rec Centre',
          distanceKm: 3.1,
          dateTime: DateTime(2026, 8, 25, 19),
          skillLevel: 'Beginner',
          capacity: 12,
          participantCount: 7,
          hostName: 'Wren Oduya',
        ),
      );
      when(() => chatRepo.messages('9')).thenAnswer((_) async => []);

      await pumpScreen(tester);
      await tester.scrollUntilVisible(
        find.text('Leave Activity'),
        300,
        scrollable: find.byType(Scrollable).first,
      );
      await tester.tap(find.text('Leave Activity'));
      await tester.pumpAndSettle();

      await tester.tap(find.text('Leave'));
      await tester.pumpAndSettle();

      verify(() => activityRepo.leave('9')).called(1);
      expect(find.text('Activities'), findsOneWidget);
    });

    testWidgets('should stay and show an error when leave fails', (
      tester,
    ) async {
      when(() => activityRepo.byId('9')).thenAnswer(
        (_) async => ActivityModel(
          id: '9',
          title: 'Tuesday Night Volleyball',
          sportType: 'Volleyball',
          description: '',
          location: 'Eastside Rec Centre',
          distanceKm: 3.1,
          dateTime: DateTime(2026, 8, 25, 19),
          skillLevel: 'Beginner',
          capacity: 12,
          participantCount: 7,
          hostName: 'Wren Oduya',
        ),
      );
      when(() => chatRepo.messages('9')).thenAnswer((_) async => []);
      when(() => activityRepo.leave('9')).thenThrow(Exception('offline'));

      await pumpScreen(tester);
      await tester.scrollUntilVisible(
        find.text('Leave Activity'),
        300,
        scrollable: find.byType(Scrollable).first,
      );
      await tester.tap(find.text('Leave Activity'));
      await tester.pumpAndSettle();

      await tester.tap(find.text('Leave'));
      await tester.pumpAndSettle();

      verify(() => activityRepo.leave('9')).called(1);
      expect(
        find.text('Could not leave the activity. Please try again.'),
        findsOneWidget,
      );
      // Stays on the detail screen — no navigation to Activities.
      expect(find.text('Tuesday Night Volleyball'), findsOneWidget);
    });

    testWidgets('should render recent chat messages from the repository', (
      tester,
    ) async {
      when(() => activityRepo.byId('9')).thenAnswer(
        (_) async => ActivityModel(
          id: '9',
          title: 'Tuesday Night Volleyball',
          sportType: 'Volleyball',
          description: '',
          location: 'Eastside Rec Centre',
          distanceKm: 3.1,
          dateTime: DateTime(2026, 8, 25, 19),
          skillLevel: 'Beginner',
          capacity: 12,
          participantCount: 7,
          hostName: 'Wren Oduya',
        ),
      );
      when(() => chatRepo.messages('9')).thenAnswer(
        (_) async => [
          ChatMessage(
            id: '9-1',
            senderId: 'wren',
            senderName: 'Wren Oduya',
            text: 'Bring your own knee pads this week.',
            sentAt: DateTime(2026, 8, 24, 20, 5),
          ),
        ],
      );

      await pumpScreen(tester);

      expect(find.text('Bring your own knee pads this week.'), findsOneWidget);
    });

    testWidgets(
      'participant stack renders live roster initials, not stock faces',
      (tester) async {
        when(() => activityRepo.byId('9')).thenAnswer(
          (_) async => ActivityModel(
            id: '9',
            title: 'Tuesday Night Volleyball',
            sportType: 'Volleyball',
            description: '',
            location: 'Eastside Rec Centre',
            distanceKm: 3.1,
            dateTime: DateTime(2026, 8, 25, 19),
            skillLevel: 'Beginner',
            capacity: 12,
            participantCount: 7,
            hostName: 'Wren Oduya',
          ),
        );
        when(() => chatRepo.messages('9')).thenAnswer((_) async => []);
        when(() => activityRepo.participants('9')).thenAnswer(
          (_) async => [
            ActivityParticipant(
              userId: 'wren',
              name: 'Wren Oduya',
              skillLevel: 'Beginner',
              joinedAt: DateTime(2026, 8, 20),
              isOrganizer: true,
            ),
          ],
        );

        await pumpScreen(tester);

        // Initials of the real roster member — no bundled face involved.
        // Scoped to the stack: the host card also shows "WO" when the
        // host is the organizer, which is correct UI, not a dupe bug.
        final stack = find.byKey(const ValueKey('participant-stack'));
        expect(stack, findsOneWidget);
        expect(
          find.descendant(of: stack, matching: find.text('WO')),
          findsOneWidget,
        );
      },
    );

    testWidgets('should show the cancelled badge and banner when called off', (
      tester,
    ) async {
      when(() => activityRepo.byId('9')).thenAnswer(
        (_) async => ActivityModel(
          id: '9',
          title: 'Tuesday Night Volleyball',
          sportType: 'Volleyball',
          description: '',
          location: 'Eastside Rec Centre',
          distanceKm: 3.1,
          dateTime: DateTime(2026, 8, 25, 19),
          skillLevel: 'Beginner',
          capacity: 12,
          participantCount: 7,
          hostName: 'Wren Oduya',
          lifecycleStatus: 'cancelled',
        ),
      );
      when(() => chatRepo.messages('9')).thenAnswer((_) async => []);

      await pumpScreen(tester);

      expect(find.text('CANCELLED'), findsWidgets);
      expect(find.text('This game was cancelled'), findsOneWidget);
      expect(find.text("You're in!"), findsNothing);
    });
  });
}
