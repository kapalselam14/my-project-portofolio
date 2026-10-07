import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:matchup_mobile/core/auth/session_events.dart';
import 'package:matchup_mobile/core/network/api_client.dart';

/// Builds an unsigned JWT with the given `exp` (epoch seconds). The
/// parser under test never verifies signatures — only the payload.
String _jwt({required int exp}) {
  String part(Object o) =>
      base64Url.encode(utf8.encode(jsonEncode(o))).replaceAll('=', '');
  return '${part({'alg': 'none'})}.${part({'exp': exp})}.sig';
}

/// In-memory stand-in for SecureTokenStore (whose platform channels
/// don't exist in unit tests).
class _MemStore {
  String? access;
  String? refresh;
  bool cleared = false;

  Future<void> clear() async {
    access = null;
    refresh = null;
    cleared = true;
  }
}

void _json(HttpRequest req, int status, Map<String, Object?> body) {
  req.response.statusCode = status;
  req.response.headers.contentType = ContentType.json;
  req.response.write(jsonEncode(body));
  unawaited(req.response.close());
}

Map<String, Object?> _unauthorized() => {
  'ok': false,
  'error': {'code': 'UNAUTHORIZED', 'message': 'expired'},
};

void main() {
  late HttpServer server;
  late List<String?> seenAuth;
  late int hits;

  setUp(() async {
    seenAuth = [];
    hits = 0;
    server = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
  });

  tearDown(() async {
    await server.close(force: true);
  });

  /// Drives [handler] for every request and returns a Dio pointed at
  /// the fake backend with [auth] as its only interceptor.
  Dio dioFor(
    AuthInterceptor auth,
    Future<void> Function(HttpRequest req) handler,
  ) {
    unawaited(() async {
      await for (final req in server) {
        hits++;
        seenAuth.add(req.headers.value('authorization'));
        await handler(req);
      }
    }());
    late final Dio dio;
    dio = Dio(
      BaseOptions(
        baseUrl: 'http://127.0.0.1:${server.port}',
        connectTimeout: const Duration(seconds: 2),
        receiveTimeout: const Duration(seconds: 2),
      ),
    );
    dio.interceptors.add(auth);
    return dio;
  }

  AuthInterceptor buildAuth(
    _MemStore store, {
    required SecureTokenExchange exchange,
    required Future<Response<dynamic>> Function(RequestOptions) retryFetch,
  }) {
    return AuthInterceptor(
      readAccessToken: () async => store.access,
      saveAccessToken: (t) async => store.access = t,
      readRefreshToken: () async => store.refresh,
      saveRefreshToken: (t) async => store.refresh = t,
      clearTokens: store.clear,
      apiKeyProvider: () => 'test-key',
      exchange: exchange,
      retryFetch: retryFetch,
    );
  }

  test(
    '401 with valid-exp token refreshes and retries with the new token',
    () async {
      final store = _MemStore()
        // Still valid for 10 min (proactive path stays quiet) but the
        // server rejects it — e.g. revoked server-side.
        ..access = _jwt(
          exp: DateTime.now().millisecondsSinceEpoch ~/ 1000 + 600,
        )
        ..refresh = 'refresh-r';
      var exchanges = 0;
      late final Dio dio;
      final auth = buildAuth(
        store,
        exchange: (r) async {
          exchanges++;
          expect(r, 'refresh-r');
          return SecureTokenPair(
            idToken: _jwt(
              exp: DateTime.now().millisecondsSinceEpoch ~/ 1000 + 3600,
            ),
            refreshToken: 'refresh-r2',
          );
        },
        retryFetch: (opts) => dio.fetch(opts),
      );
      dio = dioFor(auth, (req) async {
        if (hits == 1) {
          _json(req, 401, _unauthorized());
        } else {
          _json(req, 200, {
            'ok': true,
            'data': {'hello': 1},
          });
        }
      });

      final oldToken = store.access;
      final res = await dio.get('/me');

      expect(res.statusCode, 200);
      expect(res.data, {
        'ok': true,
        'data': {'hello': 1},
      });
      expect(exchanges, 1, reason: 'exactly one refresh');
      expect(hits, 2, reason: 'original + one retry');
      expect(seenAuth[0], 'Bearer $oldToken');
      expect(seenAuth[1], 'Bearer ${store.access}');
      expect(store.access, isNot(oldToken));
      expect(store.refresh, 'refresh-r2');
    },
  );

  test(
    'expiring token is refreshed proactively before the first send',
    () async {
      final store = _MemStore()
        ..access = _jwt(exp: DateTime.now().millisecondsSinceEpoch ~/ 1000 + 60)
        ..refresh = 'refresh-r';
      var exchanges = 0;
      late final Dio dio;
      final auth = buildAuth(
        store,
        exchange: (r) async {
          exchanges++;
          return SecureTokenPair(
            idToken: _jwt(
              exp: DateTime.now().millisecondsSinceEpoch ~/ 1000 + 3600,
            ),
          );
        },
        retryFetch: (opts) => dio.fetch(opts),
      );
      dio = dioFor(auth, (req) async {
        _json(req, 200, {'ok': true, 'data': {}});
      });

      final res = await dio.get('/me');

      expect(res.statusCode, 200);
      expect(exchanges, 1);
      expect(hits, 1, reason: 'no 401, no retry needed');
      expect(seenAuth.single, 'Bearer ${store.access}');
    },
  );

  test(
    'rejected refresh token clears storage and fires session-expired',
    () async {
      final store = _MemStore()
        ..access = _jwt(
          exp: DateTime.now().millisecondsSinceEpoch ~/ 1000 + 600,
        )
        ..refresh = 'dead-refresh';
      late final Dio dio;
      final auth = buildAuth(
        store,
        exchange: (_) async =>
            throw const UnrecoverableRefreshException('INVALID_REFRESH_TOKEN'),
        retryFetch: (opts) => dio.fetch(opts),
      );
      dio = dioFor(auth, (req) async {
        _json(req, 401, _unauthorized());
      });

      final expired = SessionEvents.instance.onSessionExpired.first;
      await expectLater(dio.get('/me'), throwsA(isA<DioException>()));
      await expired.timeout(const Duration(seconds: 2));

      expect(store.cleared, isTrue);
      expect(store.access, isNull);
      expect(hits, 1, reason: 'dead session is never retried');
    },
  );

  test('still-401-after-refresh surfaces the error without looping', () async {
    final store = _MemStore()
      ..access = _jwt(exp: DateTime.now().millisecondsSinceEpoch ~/ 1000 + 600)
      ..refresh = 'refresh-r';
    var exchanges = 0;
    late final Dio dio;
    final auth = buildAuth(
      store,
      exchange: (r) async {
        exchanges++;
        return SecureTokenPair(
          idToken: _jwt(
            exp: DateTime.now().millisecondsSinceEpoch ~/ 1000 + 3600,
          ),
        );
      },
      retryFetch: (opts) => dio.fetch(opts),
    );
    dio = dioFor(auth, (req) async {
      _json(req, 401, _unauthorized());
    });

    try {
      await dio.get('/me');
      fail('expected a 401 DioException');
    } on DioException catch (e) {
      expect(e.response?.statusCode, 401);
    }
    expect(exchanges, 1);
    expect(hits, 2, reason: 'original + exactly one retry');
  });

  test('refresh request shape: map body is url-encoded as form data, '
      'not JSON', () async {
    // Guards the exact request shape secureTokenExchange sends to
    // Google: a JSON body here would make every refresh fail with a
    // 400 and strand the user on 401s forever.
    String? contentType;
    String? rawBody;
    server.listen((req) async {
      contentType = req.headers.value('content-type');
      rawBody = await utf8.decodeStream(req);
      _json(req, 200, {
        'id_token': 'ID',
        'refresh_token': 'R',
        'expires_in': '3600',
      });
    });

    final dio = Dio();
    final res = await dio.post(
      'http://127.0.0.1:${server.port}/v1/token?key=test-key',
      data: {'grant_type': 'refresh_token', 'refresh_token': 'refresh-r'},
      options: Options(
        headers: {'Content-Type': 'application/x-www-form-urlencoded'},
      ),
    );

    expect(res.statusCode, 200);
    expect(contentType, contains('application/x-www-form-urlencoded'));
    expect(rawBody, 'grant_type=refresh_token&refresh_token=refresh-r');
  });
}
