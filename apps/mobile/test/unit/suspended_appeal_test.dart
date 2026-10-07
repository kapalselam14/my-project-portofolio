import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:matchup_mobile/core/network/api_client.dart';
import 'package:matchup_mobile/features/appeals/domain/appeal_model.dart';

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
  group('ApiException.isAccountSuspended', () {
    test('true for 403 ACCOUNT_SUSPENDED envelope', () {
      final e = ApiException.fromDio(
        _dioError(
          status: 403,
          errorBody: {
            'ok': false,
            'error': {
              'code': 'ACCOUNT_SUSPENDED',
              'message': 'Account suspended',
            },
          },
        ),
      );
      expect(e.isAccountSuspended, isTrue);
      expect(e.userMessage, 'Account suspended');
    });

    test('false for other 403s (e.g. host-only actions)', () {
      final e = ApiException.fromDio(
        _dioError(
          status: 403,
          errorBody: {
            'ok': false,
            'error': {'code': 'FORBIDDEN', 'message': 'Nope'},
          },
        ),
      );
      expect(e.isAccountSuspended, isFalse);
    });

    test('false without a server code', () {
      final e = ApiException.fromDio(_dioError(status: 403, errorBody: null));
      expect(e.isAccountSuspended, isFalse);
      expect(e.userMessage, "You don't have permission to do this.");
    });
  });

  group('AppealModel.fromJson', () {
    test('parses the backend view', () {
      final m = AppealModel.fromJson({
        'id': 'ap-1',
        'type': 'suspension',
        'statement': 'Please review.',
        'status': 'pending',
        'adminNote': null,
        'createdAt': '2026-09-01T10:00:00.000Z',
        'decidedAt': null,
      });
      expect(m.id, 'ap-1');
      expect(m.status, AppealStatus.pending);
      expect(m.createdAt?.year, 2026);
    });

    test('unknown status defaults to pending', () {
      final m = AppealModel.fromJson({'id': 'x', 'status': 'weird'});
      expect(m.status, AppealStatus.pending);
      expect(m.statement, '');
    });
  });
}
