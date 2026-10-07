import 'package:dio/dio.dart';
import 'package:flutter/services.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:matchup_mobile/core/network/api_client.dart';
import 'package:matchup_mobile/features/calendar/data/calendar_repository_impl.dart';
import 'package:matchup_mobile/features/calendar/domain/calendar_event.dart';
import 'package:matchup_mobile/features/discovery/data/activity_repository.dart';
import 'package:matchup_mobile/features/discovery/domain/activity_model.dart';
import 'package:mocktail/mocktail.dart';

class _MockApiClient extends Mock implements ApiClient {}

ActivityModel _game({
  required String id,
  required DateTime start,
  int durationMinutes = 120,
}) => ActivityModel(
  id: id,
  title: 'Game $id',
  sportType: 'Tennis',
  description: '',
  location: 'Courts',
  distanceKm: 1.0,
  dateTime: start,
  skillLevel: 'Beginner',
  capacity: 4,
  participantCount: 2,
  hostName: 'Sam',
  durationMinutes: durationMinutes,
);

class _FakeActivities implements ActivityRepository {
  _FakeActivities({required this.joined, required this.hosted});
  final List<ActivityModel> joined;
  final List<ActivityModel> hosted;

  @override
  Future<List<ActivityModel>> feed({
    int limit = 20,
    int offset = 0,
    filter,
    bool forceRefresh = false,
    bool strict = false,
  }) async => const [];

  @override
  Future<List<ActivityModel>> joinedByUser(
    String userId, {
    int limit = 20,
    int offset = 0,
  }) async => joined;

  @override
  Future<List<ActivityModel>> hostedByUser(
    String userId, {
    int limit = 20,
    int offset = 0,
  }) async => hosted;

  @override
  dynamic noSuchMethod(Invocation i) => super.noSuchMethod(i);
}

/// Activities source that throws (e.g. offline cache read failure).
class _ThrowingActivities implements ActivityRepository {
  @override
  Future<List<ActivityModel>> joinedByUser(
    String userId, {
    int limit = 20,
    int offset = 0,
  }) async => throw const ApiException(
    statusCode: null,
    userMessage: 'Cannot reach the server.',
  );

  @override
  Future<List<ActivityModel>> hostedByUser(
    String userId, {
    int limit = 20,
    int offset = 0,
  }) async => throw const ApiException(
    statusCode: null,
    userMessage: 'Cannot reach the server.',
  );

  @override
  dynamic noSuchMethod(Invocation i) => super.noSuchMethod(i);
}

/// Dio that rejects every request with a 404 (backend has no
/// `/calendar/upcoming` yet) — hermetic, no real network.
Dio _notFoundDio() {
  final dio = Dio();
  dio.interceptors.add(
    InterceptorsWrapper(
      onRequest: (options, handler) => handler.reject(
        DioException(
          requestOptions: options,
          type: DioExceptionType.badResponse,
          response: Response(
            requestOptions: options,
            statusCode: 404,
            data: {'ok': false},
          ),
        ),
      ),
    ),
  );
  return dio;
}

/// Dio that serves one canned payload for every request.
Dio _cannedDio(Object? payload) {
  final dio = Dio();
  dio.interceptors.add(
    InterceptorsWrapper(
      onRequest: (options, handler) => handler.resolve(
        Response(requestOptions: options, statusCode: 200, data: payload),
      ),
    ),
  );
  return dio;
}

_MockApiClient _clientFor(Dio dio) {
  final client = _MockApiClient();
  when(() => client.dio).thenReturn(dio);
  return client;
}

void main() {
  setUpAll(() {
    // Unit tests run outside the widget tester (plain `test`, no
    // FakeAsync zone) so real-timer futures from Dio resolve normally.
    // The binding is still needed for the SecureTokenStore channel mock.
    TestWidgetsFlutterBinding.ensureInitialized();
    // ApiClient reads Env at construction (dotenv asset, not loaded in
    // unit tests) and SecureTokenStore hits a platform channel.
    dotenv.testLoad(fileInput: 'API_BASE_URL=http://localhost:4000');
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(
          const MethodChannel('plugins.it_nomads.com/flutter_secure_storage'),
          (call) async => null,
        );
  });

  group(
    'RemoteCalendarRepository.upcoming (endpoint first, derive on 404)',
    () {
      test('404 falls back to joined + hosted, sorted, skips past', () async {
        final now = DateTime.now();
        final repo = RemoteCalendarRepository(
          client: _clientFor(_notFoundDio()),
          activities: _FakeActivities(
            joined: [
              _game(id: 'past', start: now.subtract(const Duration(days: 2))),
              _game(id: 'j1', start: now.add(const Duration(days: 2))),
            ],
            hosted: [
              _game(id: 'h1', start: now.add(const Duration(days: 1))),
              // Duplicate id across both lists appears once.
              _game(id: 'j1', start: now.add(const Duration(days: 2))),
            ],
          ),
        );

        final events = await repo.upcoming(days: 30);

        expect(events.map((e) => e.activityId), ['h1', 'j1']);
        expect(events.first.title, 'Game h1');
        expect(events.first.addedToDeviceCalendar, isFalse);
      });

      test('respects the horizon', () async {
        final now = DateTime.now();
        final repo = RemoteCalendarRepository(
          client: _clientFor(_notFoundDio()),
          activities: _FakeActivities(
            joined: [
              _game(id: 'far', start: now.add(const Duration(days: 60))),
            ],
            hosted: const [],
          ),
        );

        expect(await repo.upcoming(days: 30), isEmpty);
      });

      test('a live endpoint answer is used verbatim', () async {
        final repo = RemoteCalendarRepository(
          client: _clientFor(
            _cannedDio({
              'ok': true,
              'data': [
                {
                  'id': 's1',
                  'activity_id': 'a1',
                  'title': 'Server Game',
                  'start': DateTime.now()
                      .add(const Duration(days: 1))
                      .toUtc()
                      .toIso8601String(),
                  'end': DateTime.now()
                      .add(const Duration(days: 1, hours: 2))
                      .toUtc()
                      .toIso8601String(),
                  'location': 'Server Courts',
                },
              ],
            }),
          ),
          activities: _FakeActivities(joined: const [], hosted: const []),
        );

        final events = await repo.upcoming(days: 30);

        expect(events, hasLength(1));
        expect(events.first.title, 'Server Game');
      });

      test(
        'offline derivation failure resolves to empty, never throws',
        () async {
          final repo = RemoteCalendarRepository(
            client: _clientFor(_notFoundDio()),
            activities: _ThrowingActivities(),
          );

          expect(await repo.upcoming(days: 30), isEmpty);
        },
      );

      test('legacy mode without a source resolves to empty', () async {
        final repo = RemoteCalendarRepository(
          client: _clientFor(_notFoundDio()),
        );

        expect(await repo.upcoming(days: 30), isEmpty);
      });
    },
  );

  group('LocalCalendarRepository (offline)', () {
    test('upcoming is empty and device sync reports false', () async {
      final repo = LocalCalendarRepository();

      expect(await repo.upcoming(), isEmpty);
      expect(await repo.addToDeviceCalendar(_eventForSyncTest()), isFalse);
    });
  });
}

CalendarEvent _eventForSyncTest() => CalendarEvent(
  id: 'e1',
  activityId: 'a1',
  title: 'Sync probe',
  start: DateTime.now().add(const Duration(days: 1)),
  end: DateTime.now().add(const Duration(days: 1, hours: 2)),
  location: 'Courts',
);
