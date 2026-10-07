import '../../../core/network/api_client.dart';
import '../domain/sport_config.dart';

/// Master sports config.
abstract class SportsRepository {
  Future<List<SportConfig>> configs();
}

class RemoteSportsRepository implements SportsRepository {
  RemoteSportsRepository({ApiClient? client})
    : _client = client ?? ApiClient.instance;

  final ApiClient _client;

  @override
  Future<List<SportConfig>> configs() async {
    final res = await _client.dio.get('/public/sports');
    final rows = apiDataList(res.data)
        .whereType<Map>()
        .map((e) => SportConfig.fromJson(Map<String, dynamic>.from(e)))
        .where((c) => c.id.isNotEmpty && c.name.isNotEmpty)
        .toList();
    rows.sort((a, b) => a.sortOrder.compareTo(b.sortOrder));
    return rows;
  }
}

/// No honest offline fallback exists for admin-curated config.
class UnavailableSportsRepository implements SportsRepository {
  @override
  Future<List<SportConfig>> configs() {
    throw const ApiException(
      statusCode: null,
      userMessage: 'Sports config is unavailable offline.',
    );
  }
}
