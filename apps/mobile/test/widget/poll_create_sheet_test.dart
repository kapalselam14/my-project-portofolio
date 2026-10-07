import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';

import 'package:matchup_mobile/core/providers/repository_providers.dart';
import 'package:matchup_mobile/features/chat/data/chat_repository.dart';
import 'package:matchup_mobile/features/chat/presentation/poll_create_sheet.dart';

class _MockChatRepository extends Mock implements ChatRepository {}

void main() {
  late _MockChatRepository repo;

  setUp(() {
    repo = _MockChatRepository();
  });

  Future<void> pumpSheet(WidgetTester tester) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [chatRepositoryProvider.overrideWithValue(repo)],
        child: const MaterialApp(
          home: Scaffold(
            body: SingleChildScrollView(
              child: PollCreateSheet(activityId: 'a1'),
            ),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
  }

  testWidgets('creates a poll with the entered question and options', (
    tester,
  ) async {
    when(
      () => repo.createPoll(
        activityId: any(named: 'activityId'),
        question: any(named: 'question'),
        options: any(named: 'options'),
      ),
    ).thenAnswer((_) async => 'poll-1');

    await pumpSheet(tester);

    await tester.enterText(
      find.byType(TextField).at(0),
      'What time shall we play?',
    );
    await tester.enterText(find.byType(TextField).at(1), '4 PM');
    await tester.enterText(find.byType(TextField).at(2), '5 PM');
    await tester.pump();

    await tester.tap(find.text('Create Poll').last);
    await tester.pump();

    verify(
      () => repo.createPoll(
        activityId: 'a1',
        question: 'What time shall we play?',
        options: ['4 PM', '5 PM'],
      ),
    ).called(1);
  });

  testWidgets('refuses to create a poll with fewer than 2 options', (
    tester,
  ) async {
    await pumpSheet(tester);

    await tester.enterText(
      find.byType(TextField).at(0),
      'What time shall we play?',
    );
    await tester.enterText(find.byType(TextField).at(1), '4 PM');
    await tester.pump();

    await tester.tap(find.text('Create Poll').last);
    await tester.pump();

    verifyNever(
      () => repo.createPoll(
        activityId: any(named: 'activityId'),
        question: any(named: 'question'),
        options: any(named: 'options'),
      ),
    );
    expect(find.text('Add a question and at least 2 options.'), findsOneWidget);
  });
}
