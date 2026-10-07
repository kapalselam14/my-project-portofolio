import '../../activities/domain/activity_participant.dart';
import '../domain/activity_model.dart';
import '../domain/discovery_filter.dart';
import 'activity_repository.dart';

/// Offline-only activity store.
/// Every read returns an empty list / `null` — there is **no hardcoded seed data** anywhere in the app.
class LocalActivityRepository implements ActivityRepository {
  final Map<String, List<String>> _joinedByUser = {};
  final Map<String, List<String>> _hostedByUser = {};

  @override
  Future<List<ActivityModel>> feed({
    int limit = 20,
    int offset = 0,
    DiscoveryFilter? filter,
    bool forceRefresh = false,
    // No network here, so nothing can fail — accepted for interface compatibility with the `strict` contract only.
    bool strict = false,
  }) async {
    await _delay();
    return const <ActivityModel>[];
  }

  @override
  Future<ActivityModel?> byId(String id) async {
    await _delay();
    return null;
  }

  @override
  Future<ActivityModel?> refreshActivityDetails(String id) => byId(id);

  @override
  void invalidateFeed() {}

  @override
  Future<List<ActivityModel>> joinedByUser(
    String userId, {
    int limit = 20,
    int offset = 0,
  }) async {
    await _delay();
    final ids = _joinedByUser[userId] ?? const <String>[];
    if (ids.isEmpty) return const <ActivityModel>[];
    // No local seed to look up — these ids would correspond to activities the backend knows about.
    return const <ActivityModel>[];
  }

  @override
  Future<List<ActivityModel>> hostedByUser(
    String userId, {
    int limit = 20,
    int offset = 0,
  }) async {
    await _delay();
    final ids = _hostedByUser[userId] ?? const <String>[];
    if (ids.isEmpty) return const <ActivityModel>[];
    return const <ActivityModel>[];
  }

  @override
  Future<List<ActivityModel>> search({
    String? sport,
    String? skillLevel,
    double? maxDistanceKm,
  }) async {
    await _delay();
    return const <ActivityModel>[];
  }

  @override
  Future<ActivityModel> create({
    required String title,
    required String sportType,
    String description = '',
    required String location,
    required DateTime dateTime,
    required int maxParticipants,
    required String skillLevel,
    required double latitude,
    required double longitude,
    required String geohash,
    int durationMinutes = 120,
    String? coverImageUrl,
    String joinPolicy = 'open',
    String? address,
    bool isPaid = false,
    double? fee,
    String feeMode = 'fixed',
    double? totalCost,
    int? minPlayers,
    double? weatherTemp,
    int? weatherCode,
    String? weatherDesc,
    int? weatherRain,
  }) async {
    // Writes only succeed against the backend.
    throw StateError(
      'ActivityRepository.create() requires a live backend — no offline '
      'fallback is provided. Check your connection and retry.',
    );
  }

  @override
  Future<void> join(String activityId) async {
    await _delay();
  }

  @override
  Future<void> leave(String activityId) async {
    await _delay();
  }

  @override
  Future<void> removeParticipant({
    required String activityId,
    required String uid,
  }) async {
    await _delay();
  }

  @override
  Future<void> requestJoin(String activityId) async {
    throw StateError(
      'ActivityRepository.requestJoin() requires a live backend — no offline '
      'fallback is provided.',
    );
  }

  @override
  Future<List<ActivityParticipant>> joinRequests(String activityId) async {
    await _delay();
    return const <ActivityParticipant>[];
  }

  @override
  Future<void> approveJoinRequest(String activityId, String uid) async {
    throw StateError(
      'ActivityRepository.approveJoinRequest() requires a live backend — no '
      'offline fallback is provided.',
    );
  }

  @override
  Future<void> declineJoinRequest(String activityId, String uid) async {
    throw StateError(
      'ActivityRepository.declineJoinRequest() requires a live backend — no '
      'offline fallback is provided.',
    );
  }

  @override
  Future<void> cancel(String activityId) async {
    await _delay();
  }

  @override
  Future<void> updateStatus(String activityId, String status) async {
    await _delay();
  }

  @override
  Future<void> updateActivity({
    required String activityId,
    String? title,
    String? sportType,
    String? description,
    String? locationName,
    double? latitude,
    double? longitude,
    String? geohash,
    DateTime? startTime,
    DateTime? endTime,
    String? skillLevel,
    int? capacity,
    String? joinPolicy,
    bool? isPaid,
    double? fee,
  }) async {
    await _delay();
  }

  @override
  Future<void> updateCover({
    required String activityId,
    required String coverImagePath,
    required String coverImageUrl,
  }) async {
    throw StateError(
      'ActivityRepository.updateCover() requires a live backend — no offline '
      'fallback is provided.',
    );
  }

  @override
  Future<List<ActivityModel>> pastByUser(
    String userId, {
    int limit = 20,
    int offset = 0,
  }) async {
    await _delay();
    return const <ActivityModel>[];
  }

  @override
  Future<List<ActivityModel>> pendingRequests({
    int limit = 20,
    int offset = 0,
  }) async {
    await _delay();
    return const <ActivityModel>[];
  }

  @override
  Future<void> checkIn({
    required String activityId,
    double? latitude,
    double? longitude,
  }) async {
    throw StateError(
      'ActivityRepository.checkIn() requires a live backend — no offline '
      'fallback is provided.',
    );
  }

  @override
  Future<bool> isCheckedIn(String activityId) async {
    throw StateError(
      'ActivityRepository.isCheckedIn() requires a live backend — no offline '
      'fallback is provided.',
    );
  }

  @override
  Future<List<ActivityParticipant>> participants(String activityId) async {
    await _delay();
    return const <ActivityParticipant>[];
  }

  Future<void> _delay() => Future.delayed(const Duration(milliseconds: 50));
}
