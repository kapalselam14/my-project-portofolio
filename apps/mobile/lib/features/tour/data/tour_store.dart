/// Persists whether a given tour (identified by [tourId]) has already been shown to the user.
abstract class TourStore {
  Future<bool> hasSeen(String tourId);
  Future<void> markSeen(String tourId);

  /// Clears the seen flag so the tour can be replayed.
  Future<void> reset(String tourId);
}
