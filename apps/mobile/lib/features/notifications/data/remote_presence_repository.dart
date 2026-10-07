import 'dart:async';

import 'package:dio/dio.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_database/firebase_database.dart';
import 'package:flutter/foundation.dart';

import '../../../core/network/api_client.dart';
import '../../../core/services/rtdb_auth_service.dart';
import '../../../core/storage/secure_token_store.dart';
import '../domain/presence_state.dart';
import 'local_presence_repository.dart';
import 'presence_repository.dart';

/// HTTP-backed [PresenceRepository] for the live MatchUp API.
class RemotePresenceRepository implements PresenceRepository {
  RemotePresenceRepository({ApiClient? client, PresenceRepository? fallback})
    : _client = client ?? ApiClient.instance,
      _fallback = fallback ?? LocalPresenceRepository();

  final ApiClient _client;
  final PresenceRepository _fallback;

  /// Cadence for [watchOnline].
  static const Duration _onlinePollInterval = Duration(seconds: 30);

  /// Same 429 circuit-breaker as the typing poll: while armed, watch ticks are skipped so background polling doesn't.
  DateTime? _blockedUntil;

  bool get _isBlocked =>
      _blockedUntil != null && DateTime.now().isBefore(_blockedUntil!);

  void _noteRateLimit(DioException error) {
    if (error.response?.statusCode != 429) return;

    final raw = error.response?.headers.value('retry-after');
    final seconds = int.tryParse(raw?.trim() ?? '');

    final wait = seconds != null && seconds > 0 && seconds <= 300
        ? Duration(seconds: seconds)
        : const Duration(seconds: 30);

    _blockedUntil = DateTime.now().add(wait);

    debugPrint(
      '[RemotePresenceRepository] 429 — pausing polls until $_blockedUntil',
    );
  }

  @override
  Future<void> setMyState(PresenceState state) async {
    try {
      await _client.dio.post('/presence', data: {'state': state.wireValue});

      if (state == PresenceState.online) {
        // Best-effort and strictly additive: if arming fails.
        await _armOfflineOnDisconnect().timeout(
          const Duration(seconds: 5),
          onTimeout: () {},
        );
      }
    } catch (e, st) {
      debugPrint('[RemotePresenceRepository.setMyState] $e\n$st');
      // Don't fall through to the local fallback for writes.
    }
  }

  /// Explicit best-effort `offline` write for the logout path. Never throws.
  /// Lives here (not on the tracker widget) so the auth layer can call it without importing presentation code.
  static Future<void> markOfflineNow() async {
    try {
      final uid = await SecureTokenStore.instance.readUserId();
      if (uid == null || uid.isEmpty) return;

      await RemotePresenceRepository().setMyState(PresenceState.offline);
    } catch (error) {
      debugPrint('[RemotePresenceRepository.markOfflineNow] $error');
    }
  }

  /// Registers a server-side trigger that writes this user `offline` the moment their RTDB connection drops.
  Future<void> _armOfflineOnDisconnect() async {
    try {
      if (Firebase.apps.isEmpty) return;
      // The RTDB rule only allows an authenticated user to write their own `presence/$uid` node (`auth.uid == $uid`).
      await RtdbAuthService.instance.ensureSignedIn();

      final uid = await SecureTokenStore.instance.readUserId();
      if (uid == null || uid.isEmpty) return;

      await FirebaseDatabase.instance.ref('presence/$uid').onDisconnect().set({
        'state': 'offline',
        'lastChanged': DateTime.now().millisecondsSinceEpoch,
      });
    } catch (error) {
      debugPrint('[RemotePresenceRepository.onDisconnect] $error');
    }
  }

  @override
  Future<PresenceState?> getState(String uid) async {
    try {
      final response = await _client.dio.get('/presence/$uid');
      // Response shape: { ok, data: { state, lastChanged } }
      final data = apiDataMap(response.data);

      if (data == null) return null;

      return PresenceState.fromWire(data['state'] as String?);
    } on DioException catch (error) {
      if (error.response?.statusCode == 429) {
        _noteRateLimit(error);
      }
      // 404 = user has never reported a state. Status code (plus the normalised ApiException), never a toString sniff.

      final isNotFound =
          error.response?.statusCode == 404 ||
          (error.error is ApiException &&
              (error.error as ApiException).statusCode == 404);

      if (!isNotFound) {
        debugPrint('[RemotePresenceRepository.getState] $error');
      }

      return _fallback.getState(uid);
    } catch (error) {
      debugPrint('[RemotePresenceRepository.getState] $error');

      return _fallback.getState(uid);
    }
  }

  @override
  Stream<Set<String>> watchOnline(List<String> uids) async* {
    final watchedUids = List<String>.unmodifiable(uids);

    if (watchedUids.isEmpty) {
      yield const <String>{};
      return;
    }

    final controller = StreamController<Set<String>>();
    Timer? timer;
    var tickInFlight = false;

    Future<void> tick() async {
      if (tickInFlight || _isBlocked) return;

      tickInFlight = true;

      try {
        final results = await Future.wait(
          watchedUids.map((uid) async {
            try {
              final state = await getState(uid);

              return MapEntry(uid, state == PresenceState.online);
            } catch (_) {
              return MapEntry(uid, false);
            }
          }),
        );

        final online = <String>{
          for (final entry in results)
            if (entry.value) entry.key,
        };

        if (!controller.isClosed) {
          controller.add(online);
        }
      } finally {
        tickInFlight = false;
      }
    }

    unawaited(tick());

    timer = Timer.periodic(_onlinePollInterval, (_) {
      unawaited(tick());
    });

    controller.onCancel = () {
      timer?.cancel();
      timer = null;
    };

    try {
      yield* controller.stream;
    } finally {
      timer?.cancel();
      timer = null;

      if (!controller.isClosed) {
        await controller.close();
      }
    }
  }
}
