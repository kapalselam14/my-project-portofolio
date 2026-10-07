import 'dart:async';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:matchup_mobile/core/providers/repository_providers.dart';
import 'package:matchup_mobile/features/chat/data/dm_repository.dart';
import 'package:matchup_mobile/features/chat/domain/chat_message.dart';
import 'package:matchup_mobile/features/profile/data/user_repository.dart';
import 'package:matchup_mobile/features/profile/domain/user_model.dart';
import 'package:mocktail/mocktail.dart';

import 'package:matchup_mobile/features/chat/presentation/dm_screen.dart';

class _MockUserRepository extends Mock implements UserRepository {}

class _FakeDmRepo implements DmRepository {
  _FakeDmRepo({List<ChatMessage>? seed}) : _messages = List.of(seed ?? []) {
    _controller = StreamController<List<ChatMessage>>.broadcast(
      onListen: () => _controller.add(List.unmodifiable(_messages)),
    );
  }

  final List<ChatMessage> _messages;
  late final StreamController<List<ChatMessage>> _controller;
  final List<String> sent = [];

  @override
  Stream<List<ChatMessage>> watchMessages(String otherUid) =>
      _controller.stream;

  @override
  Future<List<ChatMessage>> messages(String otherUid, {int limit = 50}) async =>
      List.unmodifiable(_messages);

  @override
  Future<List<ChatConversation>> conversations() async => const [];

  @override
  Stream<List<ChatConversation>> watchConversations() async* {
    yield const [];
  }

  @override
  Future<void> markRead(String otherUid) async {}

  @override
  Future<ChatMessage> sendImage({
    required String otherUid,
    required String imagePath,
  }) async {
    throw UnimplementedError();
  }

  @override
  Future<ChatMessage> sendLocation({
    required String otherUid,
    required double latitude,
    required double longitude,
  }) async {
    throw UnimplementedError();
  }

  @override
  Future<ChatMessage> send({
    required String otherUid,
    required String text,
  }) async {
    sent.add(text);
    final m = ChatMessage(
      id: 'm-${sent.length}',
      senderId: 'me',
      senderName: 'You',
      text: text,
      sentAt: DateTime.now(),
      isMine: true,
    );
    _messages.add(m);
    _controller.add(List.unmodifiable(_messages));
    return m;
  }
}

ChatMessage _msg(String id, String senderId, String text) => ChatMessage(
  id: id,
  senderId: senderId,
  senderName: senderId == 'me' ? 'You' : 'Sam',
  text: text,
  sentAt: DateTime.now(),
  isMine: senderId == 'me',
);

Future<void> _pump(
  WidgetTester tester,
  _FakeDmRepo repo, {
  String peerName = 'Sam Rivera',
}) async {
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        dmRepositoryProvider.overrideWithValue(repo),
        userRepositoryProvider.overrideWithValue(_userRepo()),
      ],
      child: MaterialApp(
        home: DmScreen(otherUid: 'u-9', peerName: peerName),
      ),
    ),
  );
  await tester.pump();
  await tester.pump(const Duration(milliseconds: 100));
}

void main() {
  testWidgets('shows peer name, messages, and empty state', (tester) async {
    await _pump(tester, _FakeDmRepo());

    expect(find.text('Sam Rivera'), findsOneWidget);
    expect(find.text('Say hi to start the conversation.'), findsOneWidget);
  });

  testWidgets('renders incoming + outgoing bubbles', (tester) async {
    await _pump(
      tester,
      _FakeDmRepo(
        seed: [_msg('m-1', 'u-9', 'hey there'), _msg('m-2', 'me', 'hi!')],
      ),
    );

    expect(find.text('hey there'), findsOneWidget);
    expect(find.text('hi!'), findsOneWidget);
    // Peer avatar falls back to initials when the photo can't load —
    // twice: once in the header, once beside the peer bubble.
    expect(find.text('SR'), findsNWidgets(2));
  });

  testWidgets('shows a timestamp under each bubble', (tester) async {
    await _pump(tester, _FakeDmRepo(seed: [_msg('m-1', 'u-9', 'hey there')]));

    // e.g. "11:29 AM" — one per bubble.
    expect(
      find.textContaining(RegExp(r'^\d{1,2}:\d{2} [AP]M$')),
      findsOneWidget,
    );
  });

  testWidgets('sending appends the bubble and calls the repo', (tester) async {
    final repo = _FakeDmRepo();
    await _pump(tester, repo);

    await tester.enterText(find.byType(TextField), 'hello sam');
    await tester.pump();
    await tester.tap(find.bySemanticsLabel('Send message'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 100));

    expect(repo.sent, ['hello sam']);
    expect(find.text('hello sam'), findsOneWidget);
  });

  testWidgets('falls back to a generic title without a peer name', (
    tester,
  ) async {
    final unknownUserRepo = _MockUserRepository();
    when(() => unknownUserRepo.byId(any())).thenAnswer((_) async => null);
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          dmRepositoryProvider.overrideWithValue(_FakeDmRepo()),
          userRepositoryProvider.overrideWithValue(unknownUserRepo),
        ],
        child: const MaterialApp(home: DmScreen(otherUid: 'u-9')),
      ),
    );
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 100));

    expect(find.text('Direct message'), findsOneWidget);
  });

  testWidgets('shows the live profile name and avatar in the header', (
    tester,
  ) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          dmRepositoryProvider.overrideWithValue(_FakeDmRepo()),
          userRepositoryProvider.overrideWithValue(_userRepo()),
        ],
        child: const MaterialApp(home: DmScreen(otherUid: 'u-9')),
      ),
    );
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 100));

    // Profile displayName wins over the missing route extra; avatar
    // falls back to initials when the photo can't load in tests.
    expect(find.text('Sam Rivera'), findsOneWidget);
    expect(find.text('SR'), findsOneWidget);
  });

  testWidgets('settings sheet offers view profile and report user', (
    tester,
  ) async {
    await _pump(tester, _FakeDmRepo());

    await tester.tap(find.bySemanticsLabel('Conversation settings'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 300));

    expect(find.text('View profile'), findsOneWidget);
    expect(find.text('Report Sam Rivera'), findsOneWidget);
  });

  testWidgets('renders photo and location bubbles', (tester) async {
    // Mirrors what RemoteDmRepository produces when parsing the
    // text wire format (image URL / maps link inside `text`).
    final photo = ChatMessage(
      id: 'm-1',
      senderId: 'u-9',
      senderName: 'Sam',
      text: 'https://example.com/uploads/photo.jpg',
      sentAt: DateTime.now(),
      imageUrl: 'https://example.com/uploads/photo.jpg',
    );
    final location = ChatMessage(
      id: 'm-2',
      senderId: 'me',
      senderName: 'You',
      text: '📍 Shared location: https://maps.google.com/?q=-36.85,174.76',
      sentAt: DateTime.now(),
      isMine: true,
      latitude: -36.85,
      longitude: 174.76,
    );
    await _pump(tester, _FakeDmRepo(seed: [photo, location]));

    // Photo bubble shows the network image (_DmImage now uses
    // CachedNetworkImage instead of Image.network); location bubble shows
    // the map card instead of the raw link.
    final photoImage = find.byWidgetPredicate(
      (w) =>
          w is CachedNetworkImage &&
          w.imageUrl == 'https://example.com/uploads/photo.jpg',
    );
    expect(photoImage, findsOneWidget);
    expect(find.text('My Location'), findsOneWidget);
    expect(find.text('Tap to open in Maps'), findsOneWidget);
    expect(find.textContaining('maps.google.com'), findsNothing);
  });
}

UserRepository _userRepo() {
  final repo = _MockUserRepository();
  when(() => repo.byId(any())).thenAnswer(
    (_) async => const UserModel(
      id: 'u-9',
      displayName: 'Sam Rivera',
      avatarUrl: 'https://example.com/sam.png',
    ),
  );
  return repo;
}
