import '../domain/presence_state.dart';

/// Read/write contract for the current user's online/offline state.
/// Both [LocalPresenceRepository] (in-memory, used while the backend is in development) and [RemotePresenceRepository].
abstract class PresenceRepository {
  /// Sets the current user's presence state.
  Future<void> setMyState(PresenceState state);

  /// Fetches another user's current presence state.
  Future<PresenceState?> getState(String uid);

  /// Watches a list of uids and emits the subset that's currently online.
  Stream<Set<String>> watchOnline(List<String> uids);
}
