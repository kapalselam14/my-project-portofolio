import 'dart:convert';

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

DioException _dioError({int? status, Object? errorBody}) {
  return DioException(
    requestOptions: RequestOptions(path: '/x'),
    response: status == null
        ? null
        : Response(
            requestOptions: RequestOptions(path: '/x'),
            statusCode: status,
            data: errorBody,
          ),
    type: status == null
        ? DioExceptionType.connectionError
        : DioExceptionType.badResponse,
  );
}

void main() {
  group('idTokenExpiryMs', () {
    test('reads exp in millis', () {
      expect(idTokenExpiryMs(_jwt(exp: 1700000000)), 1700000000000);
    });

    test('returns null for garbage', () {
      expect(idTokenExpiryMs('not-a-jwt'), isNull);
      expect(idTokenExpiryMs(''), isNull);
      expect(idTokenExpiryMs('a.b'), isNull);
    });
  });

  group('isIdTokenExpiringSoon', () {
    test('true when expiring inside the skew', () {
      final exp = DateTime.now().millisecondsSinceEpoch ~/ 1000 + 60;
      expect(
        isIdTokenExpiringSoon(_jwt(exp: exp), skew: const Duration(minutes: 5)),
        isTrue,
      );
    });

    test('false when long-lived', () {
      final exp = DateTime.now().millisecondsSinceEpoch ~/ 1000 + 3600;
      expect(
        isIdTokenExpiringSoon(_jwt(exp: exp), skew: const Duration(minutes: 5)),
        isFalse,
      );
    });

    test('true when already expired or unparseable', () {
      final exp = DateTime.now().millisecondsSinceEpoch ~/ 1000 - 10;
      expect(
        isIdTokenExpiringSoon(_jwt(exp: exp), skew: const Duration(minutes: 5)),
        isTrue,
      );
      expect(
        isIdTokenExpiringSoon('garbage', skew: const Duration(minutes: 5)),
        isTrue,
      );
    });
  });

  group('isUnrecoverableRefreshError', () {
    test('flags dead-session markers', () {
      for (final marker in [
        'INVALID_REFRESH_TOKEN',
        'TOKEN_EXPIRED',
        'USER_DISABLED',
        'INVALID_GRANT',
      ]) {
        expect(
          isUnrecoverableRefreshError(
            _dioError(
              status: 400,
              errorBody: {
                'error': {'message': marker},
              },
            ),
          ),
          isTrue,
          reason: marker,
        );
      }
    });

    test('passes transient failures', () {
      // No response (network down) -> retryable.
      expect(isUnrecoverableRefreshError(_dioError()), isFalse);
      // 5xx -> retryable.
      expect(
        isUnrecoverableRefreshError(
          _dioError(
            status: 503,
            errorBody: {
              'error': {'message': 'BACKEND_DOWN'},
            },
          ),
        ),
        isFalse,
      );
      // Unknown 4xx -> retryable (conservative).
      expect(
        isUnrecoverableRefreshError(
          _dioError(
            status: 429,
            errorBody: {
              'error': {'message': 'RATE_LIMITED'},
            },
          ),
        ),
        isFalse,
      );
    });
  });

  group('SessionEvents', () {
    test('broadcasts expiry', () async {
      final future = SessionEvents.instance.onSessionExpired.first;
      SessionEvents.instance.notifySessionExpired();
      await future;
    });
  });
}
