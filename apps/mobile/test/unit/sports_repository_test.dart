import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:matchup_mobile/core/network/api_client.dart';
import 'package:matchup_mobile/features/sports/data/sports_repository.dart';
import 'package:mocktail/mocktail.dart';

class _MockApiClient extends Mock implements ApiClient {}

/// Dio that short-circuits every GET with [payload] (no network).
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

/// Dio that rejects every request with [error] (offline / 404 / …).
Dio _failingDio(DioException Function(RequestOptions) error) {
  final dio = Dio();
  dio.interceptors.add(
    InterceptorsWrapper(
      onRequest: (options, handler) => handler.reject(error(options)),
    ),
  );
  return dio;
}

void main() {
  group('RemoteSportsRepository.configs', () {
    test('parses the public sports view, sorted, dropping bad rows', () async {
      final client = _MockApiClient();
      when(() => client.dio).thenReturn(
        _cannedDio({
          'ok': true,
          'data': [
            {
              'id': 'golf',
              'name': 'Golf',
              'emoji': '⛳',
              'showInFilter': true,
              'showInOnboarding': true,
              'canHost': false,
              'sortOrder': 2,
            },
            {
              'id': 'tennis',
              'name': 'Tennis',
              'emoji': '🎾',
              'showInFilter': true,
              'showInOnboarding': true,
              'canHost': true,
              'sortOrder': 1,
            },
            // Malformed rows must not sink the list.
            {'id': '', 'name': ''},
            'not-a-map',
          ],
        }),
      );

      final configs = await RemoteSportsRepository(client: client).configs();

      expect(configs.map((c) => c.name), ['Tennis', 'Golf']);
      expect(configs.first.canHost, isTrue);
    });

    test(
      'empty server list resolves to empty (callers use fallback)',
      () async {
        final client = _MockApiClient();
        when(() => client.dio).thenReturn(_cannedDio({'ok': true, 'data': []}));

        expect(await RemoteSportsRepository(client: client).configs(), isEmpty);
      },
    );

    test('transport failure propagates so callers keep bundled list', () async {
      final client = _MockApiClient();
      when(() => client.dio).thenReturn(
        _failingDio(
          (options) => DioException(
            requestOptions: options,
            type: DioExceptionType.connectionError,
          ),
        ),
      );

      expect(
        () => RemoteSportsRepository(client: client).configs(),
        throwsA(anything),
      );
    });
  });

  group('UnavailableSportsRepository', () {
    test('throws a catchable ApiException offline (never a crash)', () async {
      expect(
        () => UnavailableSportsRepository().configs(),
        throwsA(isA<ApiException>()),
      );
    });
  });
}
