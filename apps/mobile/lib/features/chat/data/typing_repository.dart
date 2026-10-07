/// Read/write contract for "X is typing" indicators in activity chat.
/// Both [LocalTypingRepository] (in-memory, used while the backend is in development) and [RemoteTypingRepository].
abstract class TypingRepository {
  /// Sets the current user's typing state for an activity.
  Future<void> setTyping({required String activityId, required bool isTyping});

  /// Fetches a specific user's typing state for an activity.
  Future<bool?> isTyping({required String activityId, required String uid});

  /// Watches a list of uids and emits the subset that's currently typing in [activityId].
  Stream<Set<String>> watchTyping({
    required String activityId,
    required List<String> uids,
  });
}
