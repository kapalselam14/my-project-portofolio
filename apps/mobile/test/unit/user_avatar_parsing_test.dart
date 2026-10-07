import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:matchup_mobile/core/network/api_client.dart';
import 'package:matchup_mobile/features/profile/data/user_repository_impl.dart';
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

void main() {
  group('RemoteUserRepository avatar parsing', () {
    test('maps backend photoUrl onto avatarUrl', () async {
      final client = _MockApiClient();
      when(() => client.dio).thenReturn(
        _cannedDio({
          'ok': true,
          'data': {
            'authUid': 'u-9',
            'displayName': 'Sam Rivera',
            'photoUrl': 'https://example.com/sam.png',
          },
        }),
      );

      final user = await RemoteUserRepository(client: client).byId('u-9');

      expect(user?.avatarUrl, 'https://example.com/sam.png');
    });

    test('keeps legacy avatarUrl payloads working', () async {
      final client = _MockApiClient();
      when(() => client.dio).thenReturn(
        _cannedDio({
          'ok': true,
          'data': {
            'authUid': 'u-9',
            'displayName': 'Sam Rivera',
            'avatarUrl': 'https://example.com/legacy.png',
          },
        }),
      );

      final user = await RemoteUserRepository(client: client).byId('u-9');

      expect(user?.avatarUrl, 'https://example.com/legacy.png');
    });

    test('blank photoUrl normalises to null (initials fallback)', () async {
      final client = _MockApiClient();
      when(() => client.dio).thenReturn(
        _cannedDio({
          'ok': true,
          'data': {
            'authUid': 'u-9',
            'displayName': 'Sam Rivera',
            'photoUrl': '   ',
          },
        }),
      );

      final user = await RemoteUserRepository(client: client).byId('u-9');

      expect(user?.avatarUrl, isNull);
    });

    test('missing photo stays null', () async {
      final client = _MockApiClient();
      when(() => client.dio).thenReturn(
        _cannedDio({
          'ok': true,
          'data': {'authUid': 'u-9', 'displayName': 'Sam Rivera'},
        }),
      );

      final user = await RemoteUserRepository(client: client).byId('u-9');

      expect(user?.avatarUrl, isNull);
    });
  });
}
