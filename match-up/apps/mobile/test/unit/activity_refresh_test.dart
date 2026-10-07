import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:matchup_mobile/core/network/api_client.dart';
import 'package:matchup_mobile/features/discovery/data/remote_activity_repository.dart';
import 'package:mocktail/mocktail.dart';

class _MockApiClient extends Mock implements ApiClient {}

/// Dio serving canned payloads in order (no network).
Dio _cannedDio(List<Object?> payloads) {
  final dio = Dio();
  var i = 0;
  dio.interceptors.add(
    InterceptorsWrapper(
      onRequest: (options, handler) => handler.resolve(
        Response(
          requestOptions: options,
          statusCode: 200,
          data: payloads[i++ % payloads.length],
        ),
      ),
    ),
  );
  return dio;
}

Map<String, Object?> _row(String title) => {
  'ok': true,
  'data': {'id': 'a-1', 'title': title},
};

void main() {
  group('RemoteActivityRepository.refreshActivityDetails', () {
    test('byId serves the cache; refresh refetches and updates it', () async {
      final client = _MockApiClient();
      when(() => client.dio).thenReturn(_cannedDio([_row('Old'), _row('New')]));
      final repo = RemoteActivityRepository(client: client);

      expect((await repo.byId('a-1'))?.title, 'Old');
      expect((await repo.byId('a-1'))?.title, 'Old');

      expect((await repo.refreshActivityDetails('a-1'))?.title, 'New');
      expect((await repo.byId('a-1'))?.title, 'New');
    });
  });
}
