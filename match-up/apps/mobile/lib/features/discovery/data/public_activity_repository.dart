import '../domain/activity_model.dart';

/// Read-only contract for unauthenticated activity discovery.
/// The backend's `GET /api/public/activities` endpoint serves a curated, lightweight list of activities for landing.
abstract class PublicActivityRepository {
  /// Returns a small list of recent public activities to surface in unauthenticated entry points.
  Future<List<ActivityModel>> teasers({int limit = 10});
}
