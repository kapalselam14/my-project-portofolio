/// A user's swipe decision on a single activity card.
/// `pass` = the user dismissed the card (left swipe on the discovery deck).
enum SwipeDecision {
  pass,
  join;

  /// Wire-format value the backend expects (`'pass'` / `'join'`).
  String get wireValue => name;

  /// Inverse of [wireValue].
  static SwipeDecision? fromWire(String? value) {
    switch (value) {
      case 'pass':
        return SwipeDecision.pass;
      case 'join':
        return SwipeDecision.join;
      default:
        return null;
    }
  }
}

/// Persisted swipe record as returned by the backend.
class SwipeRecord {
  const SwipeRecord({
    required this.activityId,
    required this.decision,
    this.updatedAt,
  });

  final String activityId;
  final SwipeDecision decision;
  final DateTime? updatedAt;

  SwipeRecord copyWith({SwipeDecision? decision, DateTime? updatedAt}) {
    return SwipeRecord(
      activityId: activityId,
      decision: decision ?? this.decision,
      updatedAt: updatedAt ?? this.updatedAt,
    );
  }
}
