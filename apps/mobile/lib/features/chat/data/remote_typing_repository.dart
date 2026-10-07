import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';

import '../../../core/network/api_client.dart';
import 'local_typing_repository.dart';
import 'typing_repository.dart';

/// HTTP-backed [TypingRepository] for the live MatchUp API.
class RemoteTypingRepository implements TypingRepository {
  RemoteTypingRepository({ApiClient? client, TypingRepository? fallback})
      : _client = client ?? ApiClient.instance,
        _fallback = fallback ?? LocalTypingRepository();

  final ApiClient _client;
  final TypingRepository _fallback;

  /// Cadence for [watchTyping].
  static const Duration _typingPollInterval = Duration(seconds: 2);

  /// Circuit-breaker armed by any 429: while set.
  DateTime? _blockedUntil;

  bool get _isBlocked =>
      _blockedUntil != null && DateTime.now().isBefore(_blockedUntil!);

  void _noteRateLimit(DioException error) {
    if (error.response?.statusCode != 429) return;

    _blockedUntil = DateTime.now().add(_retryAfterOf(error));

    debugPrint(
      '[RemoteTypingRepository] 429 — pausing polls until $_blockedUntil',
    );
  }

  static Duration _retryAfterOf(DioException error) {
    final raw = error.response?.headers.value('retry-after');
    final seconds = int.tryParse(raw?.trim() ?? '');

    if (seconds != null && seconds > 0 && seconds <= 300) {
      return Duration(seconds: seconds);
    }

    return const Duration(seconds: 30);
  }

  @override
  Future<void> setTyping({
    required String activityId,
    required bool isTyping,
  }) async {
    try {
      await _client.dio.post(
        '/typing',
        data: {
          'activityId': activityId,
          'isTyping': isTyping,
        },
      );
    } on DioException catch (error) {
      if (error.response?.statusCode == 429) {
        _noteRateLimit(error);
      }

      debugPrint('[RemoteTypingRepository.setTyping] $error');
      await _fallback.setTyping(
        activityId: activityId,
        isTyping: isTyping,
      );
    } catch (error, stackTrace) {
      debugPrint(
        '[RemoteTypingRepository.setTyping] $error\n$stackTrace',
      );

      await _fallback.setTyping(
        activityId: activityId,
        isTyping: isTyping,
      );
    }
  }

  @override
  Future<bool?> isTyping({
    required String activityId,
    required String uid,
  }) async {
    try {
      final response = await _client.dio.get(
        '/typing/$activityId/$uid',
      );

      final data = apiDataMap(response.data);
      if (data == null) return null;

      return data['isTyping'] as bool?;
    } on DioException catch (error) {
      if (error.response?.statusCode == 429) {
        _noteRateLimit(error);
      }

      final isNotFound =
          error.response?.statusCode == 404 ||
          (error.error is ApiException &&
              (error.error as ApiException).statusCode == 404);

      if (!isNotFound) {
        debugPrint('[RemoteTypingRepository.isTyping] $error');
      }

      return _fallback.isTyping(
        activityId: activityId,
        uid: uid,
      );
    } catch (error) {
      debugPrint('[RemoteTypingRepository.isTyping] $error');

      return _fallback.isTyping(
        activityId: activityId,
        uid: uid,
      );
    }
  }

  @override
  Stream<Set<String>> watchTyping({
    required String activityId,
    required List<String> uids,
  }) async* {
    final watchedUids = List<String>.unmodifiable(uids);

    if (watchedUids.isEmpty) {
      yield const <String>{};
      return;
    }

    final controller = StreamController<Set<String>>();
    Timer? timer;
    var tickInFlight = false;
    var failures = 0;
    DateTime? backoffUntil;

    Future<void> tick() async {
      if (tickInFlight || _isBlocked) return;

      final blocked = backoffUntil;
      if (blocked != null && DateTime.now().isBefore(blocked)) {
        return;
      }

      tickInFlight = true;

      try {
        final results = await Future.wait(
          watchedUids.map((uid) async {
            try {
              final status = await isTyping(
                activityId: activityId,
                uid: uid,
              );

              return MapEntry(uid, status == true);
            } catch (_) {
              return MapEntry(uid, false);
            }
          }),
        );

        final typing = <String>{
          for (final entry in results)
            if (entry.value) entry.key,
        };

        failures = 0;
        backoffUntil = null;

        if (!controller.isClosed) {
          controller.add(typing);
        }
      } catch (_) {
        if (failures < 5) failures++;

        backoffUntil = DateTime.now().add(
          Duration(seconds: 2 * failures),
        );
      } finally {
        tickInFlight = false;
      }
    }

    unawaited(tick());
    timer = Timer.periodic(_typingPollInterval, (_) {
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
