import '../../../core/network/api_client.dart';
import '../domain/appeal_model.dart';

/// Server-backed moderation appeals (`/api/appeals`).
/// These endpoints are suspension-safe by design: a suspended account keeps its tokens precisely.
abstract class AppealRepository {
  /// Files a suspension appeal.
  Future<AppealModel> submitSuspensionAppeal({required String statement});

  /// The caller's appeals, newest-first.
  Future<List<AppealModel>> myAppeals();
}

class RemoteAppealRepository implements AppealRepository {
  RemoteAppealRepository({ApiClient? client})
    : _client = client ?? ApiClient.instance;

  final ApiClient _client;

  @override
  Future<AppealModel> submitSuspensionAppeal({
    required String statement,
  }) async {
    final res = await _client.dio.post(
      '/appeals',
      data: {'type': 'suspension', 'statement': statement},
    );
    final map = apiDataMap(res.data);
    if (map == null) {
      throw const ApiException(
        statusCode: null,
        userMessage: 'Could not submit your appeal. Please try again.',
      );
    }
    return AppealModel.fromJson(map);
  }

  @override
  Future<List<AppealModel>> myAppeals() async {
    final res = await _client.dio.get('/appeals/me');
    return apiDataList(res.data)
        .whereType<Map>()
        .map((e) => AppealModel.fromJson(Map<String, dynamic>.from(e)))
        .toList();
  }
}

/// Appeals require a live backend — there is no honest offline fallback.
class UnavailableAppealRepository implements AppealRepository {
  @override
  Future<AppealModel> submitSuspensionAppeal({required String statement}) {
    throw const ApiException(
      statusCode: null,
      userMessage: 'Appeals need an internet connection. Please try again.',
    );
  }

  @override
  Future<List<AppealModel>> myAppeals() {
    throw const ApiException(
      statusCode: null,
      userMessage: 'Could not load your appeals. Check your connection.',
    );
  }
}
