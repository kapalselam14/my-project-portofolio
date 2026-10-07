// Golden tests for the navy chat headers (group + DM).
//
// Locks the header restyle (gradient, frosted buttons, white text,
// status-bar bleed) so any future change to either header that shifts
// layout, spacing, or colour fails here first.
//
// Conventions mirror `core_widgets_golden_test.dart`: real app fonts,
// tolerant comparator for macOS/Linux rasterization drift, fixed
// 390x844 surface. Regenerate after an intentional visual change:
//   flutter test --update-goldens test/golden/chat_headers_golden_test.dart
import 'dart:async';
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';

import 'package:matchup_mobile/core/providers/repository_providers.dart';
import 'package:matchup_mobile/core/theme/dark_colors.dart';
import 'package:matchup_mobile/features/activities/domain/activity_model.dart';
import 'package:matchup_mobile/features/activities/domain/activity_participant.dart';
import 'package:matchup_mobile/features/chat/data/chat_repository.dart';
import 'package:matchup_mobile/features/chat/data/dm_repository.dart';
import 'package:matchup_mobile/features/chat/data/typing_repository.dart';
import 'package:matchup_mobile/features/chat/domain/chat_message.dart';
import 'package:matchup_mobile/features/chat/domain/chat_poll.dart';
import 'package:matchup_mobile/features/chat/presentation/chat_screen.dart';
import 'package:matchup_mobile/features/chat/presentation/dm_screen.dart';
import 'package:matchup_mobile/features/discovery/data/activity_repository.dart';
import 'package:matchup_mobile/features/profile/data/user_repository.dart';

Future<void> _loadAppFonts() async {
  final manifest =
      jsonDecode(await rootBundle.loadString('FontManifest.json'))
          as List<dynamic>;
  for (final family in manifest) {
    final loader = FontLoader((family as Map)['family'] as String);
    for (final font in (family['fonts'] as List<dynamic>)) {
      loader.addFont(rootBundle.load((font as Map)['asset'] as String));
    }
    await loader.load();
  }
}

ThemeData _goldenTheme() {
  return ThemeData(
    useMaterial3: true,
    brightness: Brightness.light,
    fontFamily: 'Geist',
    extensions: const [AppColorTokens.light],
  );
}

Widget _wrap(Widget child) {
  return MaterialApp(
    theme: _goldenTheme(),
    debugShowCheckedModeBanner: false,
    home: Scaffold(body: child),
  );
}

Future<void> _expectGolden(
  WidgetTester tester,
  Widget widget,
  String goldenName, {
  Size size = const Size(390, 844),
}) async {
  await tester.binding.setSurfaceSize(size);
  addTearDown(() => tester.binding.setSurfaceSize(null));
  await tester.pumpWidget(widget);
  await tester.pump(const Duration(milliseconds: 100));
  await tester.pump(const Duration(milliseconds: 100));
  await expectLater(
    find.byType(MaterialApp),
    matchesGoldenFile('goldens/$goldenName.png'),
  );
}

class _TolerantGoldenComparator extends LocalFileComparator {
  _TolerantGoldenComparator(super.testFile);

  static const _tolerance = 0.02;

  @override
  Future<bool> compare(Uint8List imageBytes, Uri golden) async {
    final ComparisonResult result = await GoldenFileComparator.compareLists(
      imageBytes,
      await getGoldenBytes(golden),
    );
    final bool passed = result.passed || result.diffPercent <= _tolerance;
    if (passed) {
      result.dispose();
      return true;
    }
    final String error = await generateFailureOutput(result, golden, basedir);
    result.dispose();
    throw FlutterError(error);
  }
}

class _MockChatRepository extends Mock implements ChatRepository {}

class _MockActivityRepository extends Mock implements ActivityRepository {}

class _MockTypingRepository extends Mock implements TypingRepository {}

class _MockUserRepository extends Mock implements UserRepository {}

class _FakeDmRepo implements DmRepository {
  final _controller = StreamController<List<ChatMessage>>.broadcast();

  @override
  Stream<List<ChatMessage>> watchMessages(String otherUid) =>
      _controller.stream;

  @override
  Future<List<ChatMessage>> messages(String otherUid, {int limit = 50}) async =>
      const [];

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
    throw UnimplementedError();
  }
}

ActivityModel _testActivity() => ActivityModel(
  id: 'a-1',
  title: 'Friday Night 5-a-side Football',
  sportType: 'Football',
  description: 'Weekly run',
  location: 'Eden Park Outer Oval',
  distanceKm: 1.2,
  dateTime: DateTime(2026, 9, 18, 6, 30),
  skillLevel: 'Intermediate',
  capacity: 10,
  participantCount: 2,
  hostName: 'Host',
);

void main() {
  setUpAll(() async {
    TestWidgetsFlutterBinding.ensureInitialized();
    await _loadAppFonts();
    final GoldenFileComparator current = goldenFileComparator;
    if (current is LocalFileComparator) {
      goldenFileComparator = _TolerantGoldenComparator(
        current.basedir.resolve('chat_headers_golden_test.dart'),
      );
    }
  });

  group('chat header goldens', () {
    testWidgets('group chat navy header', (tester) async {
      final repo = _MockChatRepository();
      final activityRepo = _MockActivityRepository();
      final typingRepo = _MockTypingRepository();
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
      ).thenAnswer((_) async => _testActivity());
      when(
        () => activityRepo.participants(any()),
      ).thenAnswer((_) async => const <ActivityParticipant>[]);
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

      await _expectGolden(
        tester,
        ProviderScope(
          overrides: [
            chatRepositoryProvider.overrideWithValue(repo),
            activityRepositoryProvider.overrideWithValue(activityRepo),
            typingRepositoryProvider.overrideWithValue(typingRepo),
          ],
          child: _wrap(const ChatScreen(activityId: 'a-1')),
        ),
        'chat_header_navy',
      );
    });

    testWidgets('DM navy header', (tester) async {
      final userRepo = _MockUserRepository();
      when(() => userRepo.byId(any())).thenAnswer((_) async => null);

      await _expectGolden(
        tester,
        ProviderScope(
          overrides: [
            dmRepositoryProvider.overrideWithValue(_FakeDmRepo()),
            userRepositoryProvider.overrideWithValue(userRepo),
          ],
          child: _wrap(const DmScreen(otherUid: 'u-9', peerName: 'Sam Rivera')),
        ),
        'dm_header_navy',
      );
    });
  });
}
