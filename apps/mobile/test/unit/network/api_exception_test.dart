import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:matchup_mobile/core/network/api_client.dart';

DioException _makeDioError(
  DioExceptionType type, {
  int? statusCode,
  Map<String, dynamic>? data,
}) {
  return DioException(
    requestOptions: RequestOptions(path: '/test'),
    type: type,
    response: statusCode != null
        ? Response(
            requestOptions: RequestOptions(path: '/test'),
            statusCode: statusCode,
            data: data,
          )
        : null,
  );
}

void main() {
  group('ApiException.fromDio', () {
    test('should produce a timeout message on connectionTimeout', () {
      final ex = ApiException.fromDio(
        _makeDioError(DioExceptionType.connectionTimeout),
      );
      expect(ex.statusCode, isNull);
      expect(ex.userMessage, contains('timed out'));
    });

    test('should produce a network message on connectionError', () {
      final ex = ApiException.fromDio(
        _makeDioError(DioExceptionType.connectionError),
      );
      expect(ex.statusCode, isNull);
      expect(ex.userMessage, contains('reach the server'));
    });

    test('should map HTTP 401 to session-expired message', () {
      final ex = ApiException.fromDio(
        _makeDioError(DioExceptionType.badResponse, statusCode: 401),
      );
      expect(ex.statusCode, 401);
      expect(ex.userMessage, contains('Session expired'));
    });

    test('should map HTTP 403 to permission-denied message', () {
      final ex = ApiException.fromDio(
        _makeDioError(DioExceptionType.badResponse, statusCode: 403),
      );
      expect(ex.statusCode, 403);
      expect(ex.userMessage, contains('permission'));
    });

    test('should map HTTP 404 to not-found message', () {
      final ex = ApiException.fromDio(
        _makeDioError(DioExceptionType.badResponse, statusCode: 404),
      );
      expect(ex.statusCode, 404);
    });

    test('should map HTTP 500 to server-error message', () {
      final ex = ApiException.fromDio(
        _makeDioError(DioExceptionType.badResponse, statusCode: 500),
      );
      expect(ex.userMessage, contains('Server error'));
    });

    test('should use server message from response body when present', () {
      final ex = ApiException.fromDio(
        _makeDioError(
          DioExceptionType.badResponse,
          statusCode: 422,
          data: {'message': 'Email already in use', 'code': 'EMAIL_TAKEN'},
        ),
      );
      expect(ex.userMessage, 'Email already in use');
      expect(ex.code, 'EMAIL_TAKEN');
    });

    test('should fallback to generic message for unknown status', () {
      final ex = ApiException.fromDio(
        _makeDioError(DioExceptionType.badResponse, statusCode: 418),
      );
      expect(ex.userMessage, contains('went wrong'));
    });
  });
}
