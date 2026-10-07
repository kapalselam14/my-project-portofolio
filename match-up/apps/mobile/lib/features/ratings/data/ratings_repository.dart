import '../domain/rating_models.dart';

/// Read/write contract for the post-activity rating system.
/// Implementations: [LocalRatingsRepository].
/// Both implementations are wired through [ratingsRepositoryProvider].
abstract class RatingsRepository {
  /// Records a single submission for a completed activity.
  /// Each call replaces any earlier submission by the same rater for the same activity.
  Future<RatingSubmissionResult> submitActivityRating(
    ActivityRatingSubmission submission,
  );

  /// Whether the current user has already rated a given activity.
  Future<bool> hasRated(String activityId);
}
