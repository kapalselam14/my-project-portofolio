import 'package:flutter/foundation.dart';

import '../../../core/network/api_client.dart';
import '../domain/swipe_decision.dart';
import 'local_swipes_repository.dart';
import 'swipes_repository.dart';

/// HTTP-backed [SwipesRepository] for the live MatchUp API.
/// Endpoints used: `POST /api/swipes` — record/update a decision `GET /api/swipes/me/:activityId` — fetch the current.
/// On any network failure the [LocalSwipesRepository] is used as a no-op fallback so the discovery screen doesn't.
class RemoteSwipesRepository implements SwipesRepository {
  RemoteSwipesRepository({ApiClient? client, SwipesRepository? fallback})
    : _client = client ?? ApiClient.instance,
      _fallback = fallback ?? LocalSwipesRepository();

  final ApiClient _client;
  final SwipesRepository _fallback;

  @override
  Future<void> save({
    required String activityId,
    required SwipeDecision decision,
  }) async {
    try {
      await _client.dio.post(
        '/swipes',
        data: {'activityId': activityId, 'decision': decision.wireValue},
      );
    } catch (e, st) {
      debugPrint('[RemoteSwipesRepository.save] $e\n$st');
      // Record locally so a retry stays idempotent.
      await _fallback.save(activityId: activityId, decision: decision);
      rethrow;
    }
  }

  @override
  Future<SwipeDecision?> getDecision(String activityId) async {
    try {
      final res = await _client.dio.get('/swipes/me/$activityId');
      // Response shape: { ok, data: { uid, activityId, decision, … } }
      final data = apiDataMap(res.data);
      if (data == null) return null;
      return SwipeDecision.fromWire(data['decision'] as String?);
    } on Exception catch (e) {
      // 404 is the expected response when the user hasn't swiped yet.
      final isNotFound = e.toString().contains('404');
      if (!isNotFound) {
        debugPrint('[RemoteSwipesRepository.getDecision] $e');
      }
      return _fallback.getDecision(activityId);
    }
  }

  @override
  Future<List<SwipeRecord>> listMyDecisions() async {
    try {
      final res = await _client.dio.get('/swipes/me');
      return apiDataList(res.data)
          .whereType<Map<String, dynamic>>()
          .map(_parseRecord)
          .whereType<SwipeRecord>()
          .toList();
    } catch (e, st) {
      debugPrint('[RemoteSwipesRepository.listMyDecisions] $e\n$st');
      return _fallback.listMyDecisions();
    }
  }

  SwipeRecord? _parseRecord(Map<String, dynamic> json) {
    final decision = SwipeDecision.fromWire(json['decision'] as String?);
    if (decision == null) return null;
    return SwipeRecord(
      activityId: json['activityId']?.toString() ?? '',
      decision: decision,
      updatedAt: _parseTimestamp(json['updatedAt']),
    );
  }

  DateTime? _parseTimestamp(dynamic raw) {
    if (raw == null) return null;
    if (raw is String) return DateTime.tryParse(raw);
    if (raw is Map) {
      final seconds = raw['seconds'] ?? raw['_seconds'];
      if (seconds is num) {
        return DateTime.fromMillisecondsSinceEpoch(seconds.toInt() * 1000);
      }
    }
    return null;
  }
}
