import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';

import 'package:matchup_mobile/core/providers/repository_providers.dart';
import 'package:matchup_mobile/features/chat/data/chat_repository.dart';
import 'package:matchup_mobile/features/chat/domain/chat_message.dart';
import 'package:matchup_mobile/features/chat/presentation/photo_moments_screen.dart';

class _MockChatRepository extends Mock implements ChatRepository {}

void main() {
  late _MockChatRepository repo;

  ChatMessage photo(String id, String url) => ChatMessage(
    id: id,
    senderId: 'u1',
    senderName: 'Ava',
    text: url,
    imageUrl: url,
    sentAt: DateTime(2026, 8, 27, 19),
  );

  ChatMessage text(String id) => ChatMessage(
    id: id,
    senderId: 'u2',
    senderName: 'Ben',
    text: 'See you there!',
    sentAt: DateTime(2026, 8, 27, 19, 5),
  );

  setUp(() {
    repo = _MockChatRepository();
  });

  Future<void> pumpScreen(WidgetTester tester) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [chatRepositoryProvider.overrideWithValue(repo)],
        child: const MaterialApp(home: PhotoMomentsScreen(activityId: 'a1')),
      ),
    );
    await tester.pumpAndSettle();
  }

  testWidgets('shows a grid of photo messages with count in the title', (
    tester,
  ) async {
    when(() => repo.watchMessages(any())).thenAnswer(
      (_) => Stream.value([
        photo('m1', 'https://example.com/a.jpg'),
        text('m2'),
        photo('m3', 'https://example.com/b.jpg'),
      ]),
    );

    await pumpScreen(tester);

    expect(find.text('Moments (2)'), findsOneWidget);
    // Two grid tiles (network images fall back to the error placeholder
    // in tests, but the tiles themselves still render).
    expect(find.byType(ClipRRect), findsNWidgets(2));
    expect(find.text('No photos yet'), findsNothing);
  });

  testWidgets('opens the full-screen viewer when a photo is tapped', (
    tester,
  ) async {
    when(() => repo.watchMessages(any())).thenAnswer(
      (_) => Stream.value([
        photo('m1', 'https://example.com/a.jpg'),
        photo('m3', 'https://example.com/b.jpg'),
      ]),
    );

    await pumpScreen(tester);
    await tester.tap(find.byType(ClipRRect).first);
    await tester.pumpAndSettle();

    expect(find.text('1 / 2'), findsOneWidget);
    expect(find.textContaining('Ava'), findsOneWidget);
  });

  testWidgets('shows the empty state when no photos were shared', (
    tester,
  ) async {
    when(
      () => repo.watchMessages(any()),
    ).thenAnswer((_) => Stream.value([text('m2')]));

    await pumpScreen(tester);

    expect(find.text('Moments'), findsOneWidget);
    expect(find.text('No photos yet'), findsOneWidget);
  });
}
