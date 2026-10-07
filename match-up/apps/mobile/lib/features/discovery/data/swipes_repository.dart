import '../domain/swipe_decision.dart';

/// Read/write contract for the authenticated user's swipe decisions on activity cards in the discovery deck.
/// The production app **always** uses [RemoteSwipesRepository].
abstract class SwipesRepository {
  /// Records (or updates) the user's decision for an activity.
  /// Backend behaviour: writing `join` also creates a notification for the activity host.
  Future<void> save({
    required String activityId,
    required SwipeDecision decision,
  });

  /// Returns the user's current decision for [activityId], or `null` if they haven't swiped on it yet.
  Future<SwipeDecision?> getDecision(String activityId);

  /// Lists every swipe the current user has recorded.
  Future<List<SwipeRecord>> listMyDecisions();
}
