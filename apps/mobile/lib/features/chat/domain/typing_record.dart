/// Persisted typing record as returned by the backend.
/// The backend stores the latest typing state per `(activityId.
class TypingRecord {
  const TypingRecord({
    required this.activityId,
    required this.uid,
    required this.isTyping,
  });

  final String activityId;
  final String uid;
  final bool isTyping;
}
