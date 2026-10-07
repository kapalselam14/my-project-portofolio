import 'dart:async';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:mocktail/mocktail.dart';

import 'package:matchup_mobile/core/providers/repository_providers.dart';
import 'package:matchup_mobile/core/widgets/app_avatar.dart';
import 'package:matchup_mobile/features/activities/domain/activity_model.dart';
import 'package:matchup_mobile/features/activities/domain/activity_participant.dart';
import 'package:matchup_mobile/features/chat/data/chat_repository.dart';
import 'package:matchup_mobile/features/chat/data/typing_repository.dart';
import 'package:matchup_mobile/features/chat/domain/chat_message.dart';
import 'package:matchup_mobile/features/chat/domain/chat_poll.dart';
import 'package:matchup_mobile/features/chat/presentation/chat_screen.dart';
import 'package:matchup_mobile/features/discovery/data/activity_repository.dart';
import 'package:matchup_mobile/core/utils/nav_guard.dart';

class _MockChatRepository extends Mock implements ChatRepository {}

class _MockActivityRepository extends Mock implements ActivityRepository {}

class _MockTypingRepository extends Mock implements TypingRepository {}

void main() {
  late _MockChatRepository repo;
  late _MockActivityRepository activityRepo;
  late _MockTypingRepository typingRepo;

  ActivityModel testActivity() => ActivityModel(
    id: 'Test Group',
    title: 'Test Group',
    sportType: 'Basketball',
    description: 'A test activity',
    location: 'Test Location',
    distanceKm: 1.0,
    dateTime: DateTime.now().add(const Duration(days: 1)),
    skillLevel: 'Intermediate',
    capacity: 10,
    participantCount: 1,
    hostName: 'Host',
  );

  setUpAll(() {
    registerFallbackValue(<String>[]);
  });

  setUp(() {
    NavGuard.resetForTest();
    repo = _MockChatRepository();
    activityRepo = _MockActivityRepository();
    typingRepo = _MockTypingRepository();
    // setTyping is fire-and-forget from the input listener — no-op it
    // so the test never touches the default RemoteTypingRepository
    // (which would open a real HTTP connection to the backend).
    when(
      () => typingRepo.setTyping(
        activityId: any(named: 'activityId'),
        isTyping: any(named: 'isTyping'),
      ),
    ).thenAnswer((_) async {});
    when(
      () => typingRepo.isTyping(
        activityId: any(named: 'activityId'),
        uid: any(named: 'uid'),
      ),
    ).thenAnswer((_) async => false);
    when(
      () => typingRepo.watchTyping(
        activityId: any(named: 'activityId'),
        uids: any(named: 'uids'),
      ),
    ).thenAnswer((_) => Stream.value(const <String>{}));
    // Defaults for the calls every test needs but rarely overrides.
    // Set here (not in pumpScreen) so a test's own `when(...)` stub
    // — registered after setUp, before pumpScreen — takes precedence.
    when(
      () => repo.watchMessages(any()),
    ).thenAnswer((_) => Stream.value(const <ChatMessage>[]));
    when(() => repo.watchReactions(any())).thenAnswer(
      (_) => Stream.value(const <String, Map<String, List<String>>>{}),
    );
    when(
      () => repo.watchPolls(any()),
    ).thenAnswer((_) => Stream.value(const <ChatPoll>[]));
    when(
      () => activityRepo.byId(any()),
    ).thenAnswer((_) async => testActivity());
    when(
      () => activityRepo.participants(any()),
    ).thenAnswer((_) async => const <ActivityParticipant>[]);
  });

  Future<void> pumpScreen(WidgetTester tester) async {
    final router = GoRouter(
      initialLocation: '/home',
      routes: [
        GoRoute(
          path: '/home',
          builder: (context, _) => Scaffold(
            body: Center(
              child: TextButton(
                onPressed: () => context.push('/chat/Test%20Group'),
                child: const Text('Open Chat'),
              ),
            ),
          ),
        ),
        GoRoute(
          path: '/chat/:id',
          builder: (_, state) =>
              ChatScreen(activityId: state.pathParameters['id']!),
        ),
        GoRoute(
          path: '/joined-activity/:id',
          builder: (_, state) =>
              Scaffold(body: Text('Joined ${state.pathParameters['id']}')),
        ),
        GoRoute(
          path: '/manage-activity/:id',
          builder: (_, state) =>
              Scaffold(body: Text('Manage ${state.pathParameters['id']}')),
        ),
        GoRoute(
          path: '/past-activity/:id/review',
          builder: (_, state) =>
              Scaffold(body: Text('Past ${state.pathParameters['id']}')),
        ),
        GoRoute(
          path: '/activity/:id',
          builder: (_, state) =>
              Scaffold(body: Text('Detail ${state.pathParameters['id']}')),
        ),
        GoRoute(
          path: '/player-profile/uid/:uid',
          builder: (_, state) =>
              Scaffold(body: Text('Profile ${state.pathParameters['uid']}')),
        ),
      ],
    );

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          chatRepositoryProvider.overrideWithValue(repo),
          activityRepositoryProvider.overrideWithValue(activityRepo),
          typingRepositoryProvider.overrideWithValue(typingRepo),
        ],
        child: MaterialApp.router(routerConfig: router),
      ),
    );
    await tester.pump();
    await tester.tap(find.text('Open Chat'));
    // Chat has a few cascading async providers (activity, participants,
    // typing stream) — pump a few frames instead of pumpAndSettle, which
    // can time out if any periodic timer sneaks in through a default
    // provider.
    await tester.pump(const Duration(milliseconds: 100));
    await tester.pump(const Duration(milliseconds: 100));
  }

  group('ChatScreen', () {
    testWidgets('should render messages grouped with a day separator', (
      tester,
    ) async {
      final today = DateTime.now();
      when(() => repo.watchMessages(any())).thenAnswer(
        (_) => Stream.value([
          ChatMessage(
            id: '1',
            senderId: 'alex',
            senderName: 'Alex',
            text: 'Hey there',
            sentAt: DateTime(today.year, today.month, today.day, 9, 0),
          ),
          ChatMessage(
            id: '2',
            senderId: 'alex',
            senderName: 'Alex',
            text: 'Ready for today?',
            sentAt: DateTime(today.year, today.month, today.day, 9, 1),
          ),
        ]),
      );

      await pumpScreen(tester);

      // 'TODAY' appears twice: the match banner badge + the day separator.
      expect(find.text('TODAY'), findsWidgets);
      expect(find.text('Hey there'), findsOneWidget);
      expect(find.text('Ready for today?'), findsOneWidget);
      // Only one avatar rendered for the two-message run from the same
      // sender — grouping collapses the avatar to the last bubble.
      expect(find.text('A'), findsOneWidget);
    });

    testWidgets('should send a typed message and clear the composer', (
      tester,
    ) async {
      when(
        () => repo.send(
          activityId: any(named: 'activityId'),
          text: any(named: 'text'),
        ),
      ).thenAnswer(
        (_) async => ChatMessage(
          id: 'x',
          senderId: 'me',
          senderName: 'You',
          text: 'hello',
          sentAt: DateTime.now(),
          isMine: true,
        ),
      );

      await pumpScreen(tester);

      await tester.enterText(find.byType(TextField), 'hello');
      // Let the input listener run + the send button's enabled state
      // rebuild before tapping.
      await tester.pump(const Duration(milliseconds: 50));
      await tester.pump(const Duration(milliseconds: 50));
      await tester.tap(find.bySemanticsLabel('Send message'));
      await tester.pump(const Duration(milliseconds: 100));
      await tester.pump(const Duration(milliseconds: 100));

      verify(
        () => repo.send(activityId: 'Test Group', text: 'hello'),
      ).called(1);
    });

    testWidgets('should pop back when the back button is tapped', (
      tester,
    ) async {
      await pumpScreen(tester);

      await tester.tap(find.bySemanticsLabel('Back'));
      await tester.pumpAndSettle();

      expect(find.text('Open Chat'), findsOneWidget);
    });

    testWidgets('should show the Check In button inside the check-in window', (
      tester,
    ) async {
      // Starts in 10 minutes — inside the 30-minute window.
      final soon = testActivity();
      when(() => activityRepo.byId(any())).thenAnswer(
        (_) async => ActivityModel(
          id: soon.id,
          title: soon.title,
          sportType: soon.sportType,
          description: soon.description,
          location: soon.location,
          distanceKm: soon.distanceKm,
          dateTime: DateTime.now().add(const Duration(minutes: 10)),
          skillLevel: soon.skillLevel,
          capacity: soon.capacity,
          participantCount: soon.participantCount,
          hostName: soon.hostName,
        ),
      );

      await pumpScreen(tester);
      // Extra frames for the route transition + activity future
      // so the banner rebuilds with the window evaluation.
      for (var i = 0; i < 6; i++) {
        await tester.pump(const Duration(milliseconds: 300));
      }

      // NOTE: asserted by text — the explicit Semantics label merges
      // with the child 'Check In' text node, so bySemanticsLabel
      // does not match even though the button (and its a11y label)
      // are in the tree.
      expect(find.text('Check In'), findsOneWidget);
    });

    testWidgets('should open settings with details + report rows', (
      tester,
    ) async {
      await pumpScreen(tester);

      final settings = find.bySemanticsLabel('Chat settings');
      await tester.ensureVisible(settings);
      await tester.pumpAndSettle();
      await tester.tap(settings);
      await tester.pumpAndSettle();

      expect(find.text('View activity details'), findsOneWidget);
      expect(find.text('Report activity'), findsOneWidget);
    });

    testWidgets('should route non-hosts to the public detail screen', (
      tester,
    ) async {
      await pumpScreen(tester);

      final settings = find.bySemanticsLabel('Chat settings');
      await tester.ensureVisible(settings);
      await tester.pumpAndSettle();
      await tester.tap(settings);
      await tester.pumpAndSettle();

      await tester.tap(find.text('View activity details'));
      await tester.pumpAndSettle();

      expect(find.text('Detail Test Group'), findsOneWidget);
    });

    testWidgets('should route hosts to manage-activity from settings', (
      tester,
    ) async {
      final a = testActivity();
      when(() => activityRepo.byId(any())).thenAnswer(
        (_) async => ActivityModel(
          id: a.id,
          title: a.title,
          sportType: a.sportType,
          description: a.description,
          location: a.location,
          distanceKm: a.distanceKm,
          dateTime: a.dateTime,
          skillLevel: a.skillLevel,
          capacity: a.capacity,
          participantCount: a.participantCount,
          hostName: a.hostName,
          isHost: true,
        ),
      );

      await pumpScreen(tester);

      final settings = find.bySemanticsLabel('Chat settings');
      await tester.ensureVisible(settings);
      await tester.pumpAndSettle();
      await tester.tap(settings);
      await tester.pumpAndSettle();

      expect(find.text('Manage activity'), findsOneWidget);
      expect(find.text('View activity details'), findsNothing);

      await tester.tap(find.text('Manage activity'));
      await tester.pumpAndSettle();

      expect(find.text('Manage Test Group'), findsOneWidget);
    });

    testWidgets('should hide the Check In button outside the check-in window', (
      tester,
    ) async {
      // Default testActivity starts tomorrow — far outside the window.
      await pumpScreen(tester);

      expect(find.text('Check In'), findsNothing);
    });

    testWidgets('should render a photo message inline, not as raw text', (
      tester,
    ) async {
      final today = DateTime.now();
      when(() => repo.watchMessages(any())).thenAnswer(
        (_) => Stream.value([
          ChatMessage(
            id: 'img-1',
            senderId: 'alex',
            senderName: 'Alex',
            // Backend shape: the download URL travels as the text.
            text:
                'https://firebasestorage.googleapis.com/v0/b/app/o/x?alt=media',
            sentAt: DateTime(today.year, today.month, today.day, 9, 0),
            imageUrl:
                'https://firebasestorage.googleapis.com/v0/b/app/o/x?alt=media',
          ),
        ]),
      );

      await pumpScreen(tester);
      await tester.pump(const Duration(milliseconds: 100));

      // The raw URL must never leak into the bubble as text.
      expect(
        find.text(
          'https://firebasestorage.googleapis.com/v0/b/app/o/x?alt=media',
        ),
        findsNothing,
      );
      // The bubble renders an image for the URL. The image stack is
      // CachedNetworkImage (its network error state never surfaces under
      // the test binding's fake HttpClient), so assert the image widget
      // itself with the right URL — this proves the image branch was
      // taken just as directly as the old broken-image fallback did.
      expect(
        find.byWidgetPredicate(
          (w) =>
              w is CachedNetworkImage &&
              w.imageUrl ==
                  'https://firebasestorage.googleapis.com/v0/b/app/o/x?alt=media',
        ),
        findsOneWidget,
      );
    });

    testWidgets('should render reaction chips under a reacted bubble', (
      tester,
    ) async {
      final today = DateTime.now();
      when(() => repo.watchMessages(any())).thenAnswer(
        (_) => Stream.value([
          ChatMessage(
            id: '1',
            senderId: 'alex',
            senderName: 'Alex',
            text: 'Hey there',
            sentAt: DateTime(today.year, today.month, today.day, 9, 0),
          ),
        ]),
      );
      when(() => repo.watchReactions(any())).thenAnswer(
        (_) => Stream.value(const {
          '1': {
            '🔥': ['alex', 'me'],
            '👍': ['alex'],
          },
        }),
      );

      await pumpScreen(tester);
      await tester.pump(const Duration(milliseconds: 100));

      expect(find.text('🔥 2'), findsOneWidget);
      expect(find.text('👍 1'), findsOneWidget);
    });

    testWidgets('should call toggleReaction when an emoji is picked', (
      tester,
    ) async {
      final today = DateTime.now();
      when(() => repo.watchMessages(any())).thenAnswer(
        (_) => Stream.value([
          ChatMessage(
            id: '1',
            senderId: 'alex',
            senderName: 'Alex',
            text: 'Hey there',
            sentAt: DateTime(today.year, today.month, today.day, 9, 0),
          ),
        ]),
      );
      when(
        () => repo.toggleReaction(
          activityId: any(named: 'activityId'),
          messageId: any(named: 'messageId'),
          emoji: any(named: 'emoji'),
        ),
      ).thenAnswer((_) async => true);

      await pumpScreen(tester);
      await tester.pump(const Duration(milliseconds: 100));

      // Message text is SelectableText (long-press selects for copy), so
      // the reaction picker is targeted via the bubble padding: a press
      // inside the 16x12 padding hits the bubble's own GestureDetector
      // instead of the text selection gesture.
      final textFinder = find.text('Hey there');
      final bubbleDetector = tester
          .widgetList<GestureDetector>(
            find.ancestor(
              of: textFinder,
              matching: find.byType(GestureDetector),
            ),
          )
          .firstWhere((d) => d.onLongPress != null);
      final bubbleRect = tester.getRect(find.byWidget(bubbleDetector));
      await tester.longPressAt(bubbleRect.topLeft + const Offset(6, 6));
      await tester.pump(const Duration(milliseconds: 100));

      // Reaction picker sheet offers the closed emoji set.
      expect(find.text('🔥'), findsWidgets);

      await tester.tap(find.text('🔥').last);
      await tester.pump(const Duration(milliseconds: 100));

      verify(
        () => repo.toggleReaction(
          activityId: 'Test Group',
          messageId: '1',
          emoji: '🔥',
        ),
      ).called(1);
    });

    testWidgets('should render system messages as a centered pill', (
      tester,
    ) async {
      final today = DateTime.now();
      when(() => repo.watchMessages(any())).thenAnswer(
        (_) => Stream.value([
          ChatMessage(
            id: 'sys-1',
            senderId: 'system',
            senderName: '',
            text: 'Sam left the group',
            sentAt: DateTime(today.year, today.month, today.day, 9, 0),
            messageType: 'system',
          ),
        ]),
      );

      await pumpScreen(tester);
      await tester.pump(const Duration(milliseconds: 100));

      expect(find.text('Sam left the group'), findsOneWidget);

      // No reaction picker on long-press: system events are not messages.
      await tester.longPress(find.text('Sam left the group'));
      await tester.pump(const Duration(milliseconds: 100));
      expect(find.text('🔥'), findsNothing);
    });

    ChatPoll testPoll() {
      final today = DateTime.now();
      return ChatPoll(
        pollId: 'p1',
        question: 'What time shall we play?',
        options: const ['4 PM', '5 PM'],
        createdBy: 'alex',
        createdAt: DateTime(today.year, today.month, today.day, 9, 5),
        votes: const {
          0: ['alex'],
        },
      );
    }

    testWidgets('should render a poll inline with options and vote shares', (
      tester,
    ) async {
      final today = DateTime.now();
      when(() => repo.watchMessages(any())).thenAnswer(
        (_) => Stream.value([
          ChatMessage(
            id: '1',
            senderId: 'alex',
            senderName: 'Alex',
            text: 'Hey there',
            sentAt: DateTime(today.year, today.month, today.day, 9, 0),
          ),
        ]),
      );
      when(
        () => repo.watchPolls(any()),
      ).thenAnswer((_) => Stream.value([testPoll()]));

      await pumpScreen(tester);
      await tester.pump(const Duration(milliseconds: 100));

      expect(find.text('What time shall we play?'), findsOneWidget);
      expect(find.text('4 PM'), findsOneWidget);
      expect(find.text('5 PM'), findsOneWidget);
      expect(find.text('100%'), findsOneWidget);
      expect(find.text('0%'), findsOneWidget);
      expect(find.text('1 vote · tap to vote'), findsOneWidget);
    });

    testWidgets('should call votePoll when a poll option is tapped', (
      tester,
    ) async {
      when(
        () => repo.watchMessages(any()),
      ).thenAnswer((_) => Stream.value(const <ChatMessage>[]));
      when(
        () => repo.watchPolls(any()),
      ).thenAnswer((_) => Stream.value([testPoll()]));
      when(
        () => repo.votePoll(
          activityId: any(named: 'activityId'),
          pollId: any(named: 'pollId'),
          optionIndex: any(named: 'optionIndex'),
        ),
      ).thenAnswer((_) async => true);

      await pumpScreen(tester);
      await tester.pump(const Duration(milliseconds: 100));

      await tester.tap(find.text('5 PM'));
      await tester.pump(const Duration(milliseconds: 100));

      verify(
        () => repo.votePoll(
          activityId: 'Test Group',
          pollId: 'p1',
          optionIndex: 1,
        ),
      ).called(1);
    });

    testWidgets('tapping a sender avatar opens their profile', (tester) async {
      final today = DateTime.now();
      when(() => repo.watchMessages(any())).thenAnswer(
        (_) => Stream.value([
          ChatMessage(
            id: '1',
            senderId: 'alex-uid',
            senderName: 'Alex',
            text: 'Hey there',
            sentAt: DateTime(today.year, today.month, today.day, 9, 0),
          ),
        ]),
      );
      when(
        () => repo.watchPolls(any()),
      ).thenAnswer((_) => Stream.value(const <ChatPoll>[]));

      await pumpScreen(tester);
      await tester.pumpAndSettle();

      // Avatar carries an accessibility label (merged with the
      // initials fallback text) and both avatar + name navigate.
      final sem = tester.getSemantics(find.byType(AppAvatar));
      expect(sem.label, contains('View Alex profile'));

      await tester.tap(find.text('Alex'));
      await tester.pumpAndSettle();

      expect(find.text('Profile alex-uid'), findsOneWidget);
    });

    testWidgets('double-tapping a sender never duplicates the profile page', (
      tester,
    ) async {
      final today = DateTime.now();
      when(() => repo.watchMessages(any())).thenAnswer(
        (_) => Stream.value([
          ChatMessage(
            id: '1',
            senderId: 'alex-uid',
            senderName: 'Alex',
            text: 'Hey there',
            sentAt: DateTime(today.year, today.month, today.day, 9, 0),
          ),
        ]),
      );
      when(
        () => repo.watchPolls(any()),
      ).thenAnswer((_) => Stream.value(const <ChatPoll>[]));

      await pumpScreen(tester);
      await tester.pumpAndSettle();

      // Two taps with no settle in between: without the push guard the
      // second push duplicates the page key and red-screens
      // ('!keyReservation.contains(key)').
      await tester.tap(find.text('Alex'));
      await tester.tap(find.text('Alex'));
      await tester.pumpAndSettle();

      expect(find.text('Profile alex-uid'), findsOneWidget);
    });

    group('View activity details routing', () {
      Future<void> openDetails(
        WidgetTester tester, {
        String rowLabel = 'View activity details',
      }) async {
        await pumpScreen(tester);
        await tester.pump(const Duration(milliseconds: 100));
        final settings = find.bySemanticsLabel('Chat settings');
        await tester.ensureVisible(settings);
        await tester.pumpAndSettle();
        await tester.tap(settings);
        await tester.pumpAndSettle();
        await tester.tap(find.text(rowLabel));
        await tester.pumpAndSettle();
      }

      testWidgets('participant sees the joined detail, not discover', (
        tester,
      ) async {
        when(
          () => activityRepo.byId(any()),
        ).thenAnswer((_) async => testActivity().copyWith(isParticipant: true));

        await openDetails(tester);

        expect(find.text('Joined Test Group'), findsOneWidget);
        expect(find.text('Discover Test Group'), findsNothing);
      });

      testWidgets('host sees the manage screen', (tester) async {
        when(
          () => activityRepo.byId(any()),
        ).thenAnswer((_) async => testActivity().copyWith(isHost: true));

        await openDetails(tester, rowLabel: 'Manage activity');

        expect(find.text('Manage Test Group'), findsOneWidget);
      });

      testWidgets('past games open the review screen', (tester) async {
        when(() => activityRepo.byId(any())).thenAnswer(
          (_) async => testActivity().copyWith(
            isParticipant: true,
            status: ActivityStatus.past,
          ),
        );

        await openDetails(tester);

        expect(find.text('Past Test Group'), findsOneWidget);
      });
    });
  });
}
