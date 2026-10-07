import 'dart:async';

import '../domain/presence_state.dart';
import 'presence_repository.dart';

/// Offline-only presence store.
class LocalPresenceRepository implements PresenceRepository {
  @override
  Future<void> setMyState(PresenceState state) async {}

  @override
  Future<PresenceState?> getState(String uid) async {
    return null;
  }

  @override
  Stream<Set<String>> watchOnline(List<String> uids) async* {
    yield const <String>{};
  }
}
