import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../domain/rating_models.dart';
import 'ratings_repository.dart';

/// In-memory ratings repository used while the backend endpoint is in development.
class LocalRatingsRepository implements RatingsRepository {
  /// activityId → set of rater UIDs that already submitted.
  final Map<String, Set<String>> _submitted = {};

  /// Records known rater uid from the auth state.
  LocalRatingsRepository({this._currentUserId = 'me'}) {
    _restorePersisted();
  }

  final String _currentUserId;

  /// SharedPreferences key holding the list of rated activityIds for [_currentUserId].
  String get _prefsKey => 'rated_activities_$_currentUserId';

  Future<void> _restorePersisted() async {
    try {
      final prefs = await SharedPreferences.getInstance().timeout(
        const Duration(seconds: 2),
      );
      final ids = prefs.getStringList(_prefsKey) ?? const <String>[];
      for (final id in ids) {
        _submitted.putIfAbsent(id, () => <String>{}).add(_currentUserId);
      }
    } catch (_) {
      // No persisted state (e.g. widget tests without a prefs mock) — fall back to memory only.
    }
  }

  Future<void> _persistRated(String activityId) async {
    try {
      final prefs = await SharedPreferences.getInstance().timeout(
        const Duration(seconds: 2),
      );
      final ids = Set<String>.from(prefs.getStringList(_prefsKey) ?? <String>[])
        ..add(activityId);
      await prefs
          .setStringList(_prefsKey, ids.toList())
          .timeout(const Duration(seconds: 2));
    } catch (_) {
      // Persistence is best-effort; the in-memory entry above already covers the current session.
    }
  }

  @override
  Future<RatingSubmissionResult> submitActivityRating(
    ActivityRatingSubmission submission,
  ) async {
    // Simulate small network latency so loading states are exercisable.
    await Future<void>.delayed(const Duration(milliseconds: 220));

    _submitted
        .putIfAbsent(submission.activityId, () => <String>{})
        .add(_currentUserId);
    // Fire-and-forget: persistence must never block the submit result.
    unawaited(_persistRated(submission.activityId));

    if (kDebugMode) {
      debugPrint(
        '[LocalRatingsRepository] stored ${submission.participants.length} '
        'rating(s) for activity=${submission.activityId}',
      );
    }

    return RatingSubmissionResult(accepted: true, submittedAt: DateTime.now());
  }

  @override
  Future<bool> hasRated(String activityId) async {
    final raters = _submitted[activityId];
    if (raters != null && raters.contains(_currentUserId)) return true;
    // Fall back to persisted state (covers restarts before the constructor restore lands, or a fresh instance).
    try {
      final prefs = await SharedPreferences.getInstance().timeout(
        const Duration(seconds: 2),
      );
      final ids = prefs.getStringList(_prefsKey) ?? const <String>[];
      if (ids.contains(activityId)) {
        _submitted
            .putIfAbsent(activityId, () => <String>{})
            .add(_currentUserId);
        return true;
      }
    } catch (_) {
      // Prefs unavailable (e.g. widget tests) — memory only.
    }
    return false;
  }
}
