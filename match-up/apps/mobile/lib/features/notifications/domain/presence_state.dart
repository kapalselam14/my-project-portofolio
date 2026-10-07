/// Whether a user is currently online.
enum PresenceState {
  online,
  offline;

  /// Wire-format value the backend expects (`'online' | 'offline'`).
  String get wireValue => name;

  /// Inverse of [wireValue].
  static PresenceState? fromWire(String? value) {
    switch (value) {
      case 'online':
        return PresenceState.online;
      case 'offline':
        return PresenceState.offline;
      default:
        return null;
    }
  }
}

/// A snapshot of one user's presence state as returned by the backend.
class PresenceRecord {
  const PresenceRecord({required this.uid, required this.state});

  final String uid;
  final PresenceState state;
}
