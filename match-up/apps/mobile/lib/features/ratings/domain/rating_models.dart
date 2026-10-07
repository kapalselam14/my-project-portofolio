/// Models for the post-activity community rating system.
/// Each completed activity prompts every participant to give a single 1-5 star rating to each other participant they.
library;

/// One rating submitted against a single other participant.
/// The activity-level `comment` is shared across all participant rows in the current screen.
class ParticipantRatingSubmission {
  const ParticipantRatingSubmission({
    required this.rateeUserId,
    required this.stars,
  });

  /// Auth UID of the participant being rated.
  final String rateeUserId;

  /// 1-5 inclusive. UI must enforce the range before constructing.
  final int stars;
}

/// Full payload for one submission to the rating endpoint.
class ActivityRatingSubmission {
  const ActivityRatingSubmission({
    required this.activityId,
    required this.activitySportType,
    required this.participants,
    this.comment,
    this.activityStars,
  });

  /// Activity being rated. Must already be in the `past` state.
  final String activityId;

  /// Sport taxonomy at the time of submission.
  final String activitySportType;

  /// One entry per other participant (the rater is excluded — clients must drop themselves before submitting).
  final List<ParticipantRatingSubmission> participants;

  /// Optional one-liner (<=500 chars on UI side, backend contract).
  final String? comment;

  /// Optional activity-level 1-5 stars.
  final int? activityStars;
}

/// Outcome of a submit attempt.
class RatingSubmissionResult {
  const RatingSubmissionResult({
    required this.accepted,
    required this.submittedAt,
    this.remoteError,
  });

  final bool accepted;

  /// When the rating was recorded (local clock if remote, server clock when available.
  final DateTime submittedAt;

  /// Populated when [accepted] is false so the screen can surface the server message or, in fallback mode, just say.
  final String? remoteError;
}

/// Summary of aggregate rating for a user.
class SportRatingSummary {
  const SportRatingSummary({required this.average, required this.count});

  /// Running average across all completed activities the user played within [SportRatingSummary.sportType].
  final double average;

  /// Total ratings considered in [average]. Used to label "★ 4.8 (12)".
  final int count;

  bool get hasRatings => count > 0;
}

/// Roll-up of a user's ratings across every sport they have feedback for, keyed by sport type.
typedef RatingBySport = Map<String, SportRatingSummary>;
