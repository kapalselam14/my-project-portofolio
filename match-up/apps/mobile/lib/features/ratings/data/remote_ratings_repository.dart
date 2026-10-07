import 'package:flutter/foundation.dart';

import '../../../core/network/api_client.dart';
import '../domain/rating_models.dart';
import 'ratings_repository.dart';
import 'ratings_repository_impl.dart';

/// HTTP-backed [RatingsRepository].
class RemoteRatingsRepository implements RatingsRepository {
  RemoteRatingsRepository({
    ApiClient? client,
    RatingsRepository? fallback,
    String currentUserId = 'me',
  }) : _client = client ?? ApiClient.instance,
       _fallback =
           fallback ?? LocalRatingsRepository(currentUserId: currentUserId);

  final ApiClient _client;
  final RatingsRepository _fallback;

  @override
  Future<RatingSubmissionResult> submitActivityRating(
    ActivityRatingSubmission submission,
  ) async {
    try {
      final res = await _client.dio.post(
        '/activities/${submission.activityId}/ratings',
        data: {
          'sportType': submission.activitySportType,
          if (submission.comment != null) 'comment': submission.comment,
          if (submission.activityStars != null)
            'activityStars': submission.activityStars,
          'participantRatings': submission.participants
              .map((p) => {'rateeUid': p.rateeUserId, 'stars': p.stars})
              .toList(),
        },
      );

      final accepted =
          res.statusCode != null &&
          res.statusCode! >= 200 &&
          res.statusCode! < 300;
      return RatingSubmissionResult(
        accepted: accepted,
        submittedAt: DateTime.now(),
        remoteError: accepted ? null : 'Server returned ${res.statusCode}',
      );
    } catch (e) {
      debugPrint('[RemoteRatingsRepository] submit failed: $e');
      return RatingSubmissionResult(
        accepted: false,
        submittedAt: DateTime.now(),
        remoteError: e.toString(),
      );
    }
  }

  @override
  Future<bool> hasRated(String activityId) async {
    try {
      final res = await _client.dio.get('/activities/$activityId/my-rating');
      // Enveloped as `{ok, data: {hasRated}}`.
      final data = apiDataMap(res.data);
      return data?['hasRated'] == true;
    } catch (_) {
      return _fallback.hasRated(activityId);
    }
  }
}
