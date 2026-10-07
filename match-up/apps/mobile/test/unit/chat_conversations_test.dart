import 'package:flutter/services.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:matchup_mobile/features/activities/domain/activity_model.dart';
import 'package:matchup_mobile/features/chat/data/chat_repository_impl.dart';
import 'package:matchup_mobile/features/chat/domain/chat_message.dart';
import 'package:matchup_mobile/features/discovery/data/remote_activity_repository.dart';

class _MockActivities extends Mock implements RemoteActivityRepository {}

/// RemoteChatRepository with the message transport stubbed out — the
/// inbox threads resolve previews via [messages], which needs no
/// network for this test (empty thread = empty preview, still a row).
class _TestChatRepo extends RemoteChatRepository {
  _TestChatRepo({required RemoteActivityRepository activities})
    : super(activities: activities);

  @override
  Future<List<ChatMessage>> messages(String activityId) async => [];
}

ActivityModel _game(
  String id, {
  ActivityStatus status = ActivityStatus.hosted,
}) {
  return ActivityModel(
    id: id,
    title: 'Game $id',
    sportType: 'Basketball',
    description: 'd',
    location: 'Park',
    distanceKm: 1,
    dateTime: DateTime.now().add(const Duration(days: 1)),
    skillLevel: 'any',
    capacity: 10,
    participantCount: 2,
    hostName: 'Lisa',
    status: status,
    isHost: true,
  );
}

void main() {
  late _MockActivities activities;

  setUpAll(() {
    dotenv.testLoad(fileInput: 'API_BASE_URL=http://localhost:4000');
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(
          const MethodChannel('plugins.it_nomads.com/flutter_secure_storage'),
          (call) async => null,
        );
    SharedPreferences.setMockInitialValues({});
  });

  setUp(() {
    activities = _MockActivities();
  });

  // Regression: the inbox used to derive from the open-status feed, so
  // completed/full/cancelled hosted games never appeared (14 hosted
  // but only 7 groups). It now merges hosted + joined across all
  // statuses.
  testWidgets('inbox includes hosted games of every status', (tester) async {
    final hosted = [
      for (var i = 0; i < 7; i++) _game('open-$i'),
      for (var i = 0; i < 7; i++) _game('past-$i', status: ActivityStatus.past),
    ];
    when(
      () => activities.hostedByUser(any(), limit: any(named: 'limit')),
    ).thenAnswer((_) async => hosted);
    when(
      () => activities.joinedByUser(any(), limit: any(named: 'limit')),
    ).thenAnswer((_) async => []);

    final convos = await _TestChatRepo(activities: activities).conversations();

    expect(convos, hasLength(14));
    expect(
      convos.map((c) => c.id),
      containsAll([for (var i = 0; i < 7; i++) 'past-$i']),
    );
  });

  testWidgets('inbox merges joined and dedupes overlap', (tester) async {
    when(
      () => activities.hostedByUser(any(), limit: any(named: 'limit')),
    ).thenAnswer((_) async => [_game('a'), _game('b')]);
    when(
      () => activities.joinedByUser(any(), limit: any(named: 'limit')),
    ).thenAnswer((_) async => [_game('b'), _game('c')]);

    final convos = await _TestChatRepo(activities: activities).conversations();

    expect(convos.map((c) => c.id), ['a', 'b', 'c']);
  });

  testWidgets('inbox is empty when the user has no games', (tester) async {
    when(
      () => activities.hostedByUser(any(), limit: any(named: 'limit')),
    ).thenAnswer((_) async => []);
    when(
      () => activities.joinedByUser(any(), limit: any(named: 'limit')),
    ).thenAnswer((_) async => []);

    final convos = await _TestChatRepo(activities: activities).conversations();

    expect(convos, isEmpty);
  });
}
