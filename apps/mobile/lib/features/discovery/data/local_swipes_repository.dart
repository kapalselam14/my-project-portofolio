import '../domain/swipe_decision.dart';
import 'swipes_repository.dart';

/// Offline-only swipes store.
class LocalSwipesRepository implements SwipesRepository {
  @override
  Future<void> save({
    required String activityId,
    required SwipeDecision decision,
  }) async {}

  @override
  Future<SwipeDecision?> getDecision(String activityId) async {
    return null;
  }

  @override
  Future<List<SwipeRecord>> listMyDecisions() async {
    return const <SwipeRecord>[];
  }
}
