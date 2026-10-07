import '../../activities/domain/activity_participant.dart';
import '../domain/activity_model.dart';
import '../domain/discovery_filter.dart';

/// Read/write contract for activity data.
abstract class ActivityRepository {
  /// Discovery feed.
  /// Implementations may serve a short-TTL in-memory cache.
  /// When [strict] is true, failures rethrow the original error instead of falling back to the offline store.
  Future<List<ActivityModel>> feed({
    int limit = 20,
    int offset = 0,
    DiscoveryFilter? filter,
    bool forceRefresh = false,
    bool strict = false,
  });

  Future<ActivityModel?> byId(String id);

  /// Re-reads one activity bypassing the detail/roster caches (pull-to-refresh
  /// after a remote edit — the short-TTL cache would otherwise serve stale rows).
  Future<ActivityModel?> refreshActivityDetails(String id);

  /// Drops cached feed pages so post-push refetches observe remote edits.
  void invalidateFeed();

  /// Roster for a single activity, used by the Activity Participants screen.
  Future<List<ActivityParticipant>> participants(String activityId);

  Future<List<ActivityModel>> joinedByUser(
    String userId, {
    int limit = 20,
    int offset = 0,
  });

  Future<List<ActivityModel>> hostedByUser(
    String userId, {
    int limit = 20,
    int offset = 0,
  });

  Future<List<ActivityModel>> search({
    String? sport,
    String? skillLevel,
    double? maxDistanceKm,
  });

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
  });

  Future<void> join(String activityId);

  Future<void> leave(String activityId);

  /// Host-only removal of another participant (`DELETE /api/activities/:activityId/participants/:uid`).
  Future<void> removeParticipant({
    required String activityId,
    required String uid,
  });

  /// Files a join request on an approval-gated activity.
  Future<void> requestJoin(String activityId);

  /// Pending join requests for an activity.
  Future<List<ActivityParticipant>> joinRequests(String activityId);

  /// Host-only decision on a pending request.
  Future<void> approveJoinRequest(String activityId, String uid);

  /// Host-only decision on a pending request.
  Future<void> declineJoinRequest(String activityId, String uid);

  /// Cancels a hosted activity, notifying all participants.
  Future<void> cancel(String activityId);

  /// Host-only field update (`PATCH /api/activities/:id`).
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
  });

  /// Host-only cover update (`PATCH /api/activities/:activityId/cover`).
  Future<void> updateCover({
    required String activityId,
    required String coverImagePath,
    required String coverImageUrl,
  });

  /// Generic host-only status update.
  Future<void> updateStatus(String activityId, String status);

  Future<List<ActivityModel>> pastByUser(
    String userId, {
    int limit = 20,
    int offset = 0,
  });

  /// Outgoing pending join requests (`GET /api/activities/join-requests/me`), mapped to lightweight.
  Future<List<ActivityModel>> pendingRequests({int limit = 20, int offset = 0});

  /// Persists a check-in (`POST /api/activities/:id/check-in`).
  Future<void> checkIn({
    required String activityId,
    double? latitude,
    double? longitude,
  });

  /// Whether the viewer already checked in (`GET /api/activities/:id/check-in/me`).
  Future<bool> isCheckedIn(String activityId);
}
