import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/providers/repository_providers.dart';
import '../../../core/storage/secure_token_store.dart';
import '../domain/presence_state.dart';

/// Bridges Flutter's app-lifecycle events to the backend's presence API.
/// On every `resumed` we mark the user `online`; on `paused`, `detached`, and `hidden` we mark them `offline`.
class PresenceTracker extends ConsumerStatefulWidget {
  const PresenceTracker({super.key, required this.child});

  final Widget child;

  @override
  ConsumerState<PresenceTracker> createState() => _PresenceTrackerState();
}

class _PresenceTrackerState extends ConsumerState<PresenceTracker>
    with WidgetsBindingObserver {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    // Fire one online update on first build — the observer fires `resumed` for the *current* state.
    unawaited(_set(PresenceState.online));
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    switch (state) {
      case AppLifecycleState.resumed:
        unawaited(_set(PresenceState.online));
      case AppLifecycleState.paused:
      case AppLifecycleState.detached:
      case AppLifecycleState.hidden:
        unawaited(_set(PresenceState.offline));
      case AppLifecycleState.inactive:
        // `inactive` is brief (control centre, incoming call).
        break;
    }
  }

  Future<void> _set(PresenceState state) async {
    try {
      // Auth guard: with no session (logged out, tokens cleared) there is no uid to mark.
      final uid = await SecureTokenStore.instance.readUserId();
      if (uid == null || uid.isEmpty) return;
      final repo = ref.read(presenceRepositoryProvider);
      await repo.setMyState(state);
    } catch (e, st) {
      if (kDebugMode) {
        debugPrint('[PresenceTracker] setMyState($state) failed: $e\n$st');
      }
    }
  }

  @override
  Widget build(BuildContext context) => widget.child;
}
