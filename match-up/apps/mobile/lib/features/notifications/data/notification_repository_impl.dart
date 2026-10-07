import 'package:flutter/foundation.dart';

import '../../../core/network/api_client.dart';
import '../domain/app_notification.dart';
import 'notification_repository.dart';

/// Offline-only notification store.
class LocalNotificationRepository implements NotificationRepository {
  @override
  Future<List<AppNotification>> all() async {
    return const <AppNotification>[];
  }

  @override
  Future<List<AppNotification>> unread() async {
    return const <AppNotification>[];
  }

  @override
  Future<bool> markRead(String id) async {
    return true;
  }

  @override
  Future<bool> markAllRead() async {
    return true;
  }
}

class RemoteNotificationRepository implements NotificationRepository {
  RemoteNotificationRepository({ApiClient? client})
    : _client = client ?? ApiClient.instance;

  final ApiClient _client;

  @override
  Future<List<AppNotification>> all() async {
    // Canonical route is `GET /api/notifications/me` (no `/unread` variant exists on the backend).
    final res = await _client.dio.get('/notifications/me');
    return apiDataList(
      res.data,
    ).map(_parse).whereType<AppNotification>().toList();
  }

  @override
  Future<List<AppNotification>> unread() async {
    final items = await all();
    return items.where((n) => n.unread).toList();
  }

  @override
  Future<bool> markRead(String id) async {
    try {
      // Canonical route is `PATCH /api/notifications/me/:id/read`.
      await _client.dio.patch('/notifications/me/$id/read');
      return true;
    } catch (e, st) {
      debugPrint('[RemoteNotificationRepository.markRead] $e\n$st');
      return false;
    }
  }

  @override
  Future<bool> markAllRead() async {
    // No bulk endpoint on the backend — fan out per-notification.
    try {
      final pending = await unread();
      var ok = true;
      await Future.wait(
        pending.map((n) async {
          try {
            await _client.dio.patch('/notifications/me/${n.id}/read');
          } catch (_) {
            ok = false;
          }
        }),
      );
      return ok;
    } catch (e, st) {
      debugPrint('[RemoteNotificationRepository.markAllRead] $e\n$st');
      return false;
    }
  }

  /// Parses one backend row, or `null` when the row is malformed.
  AppNotification? _parse(dynamic raw) {
    final json = raw is Map<String, dynamic>
        ? raw
        : raw is Map
        ? Map<String, dynamic>.from(raw)
        : null;
    if (json == null) return null;
    String? clean(Object? v) {
      final s = v?.toString().trim() ?? '';
      return s.isEmpty ? null : s;
    }

    return AppNotification(
      id: json['notificationId']?.toString() ?? json['id']?.toString() ?? '',
      title: json['title'] as String? ?? '',
      body: json['body'] as String?,
      createdAt: _parseTimestamp(json['createdAt']) ?? DateTime.now(),
      type: _typeFromString(json['type'] as String? ?? 'system'),
      unread: !(json['isRead'] as bool? ?? true),
      activityId: clean(json['activityId']),
      senderUid: clean(json['senderUid']),
      audience: clean(json['audience']),
      backendType: (json['type'] as String? ?? 'system').trim(),
    );
  }

  DateTime? _parseTimestamp(dynamic raw) {
    if (raw == null) return null;
    if (raw is String) return DateTime.tryParse(raw);
    if (raw is num) {
      // Epoch numbers arrive in both precisions: millis (13 digits) and seconds (10 digits).
      final ms = raw.toInt() > 100000000000 ? raw.toInt() : raw.toInt() * 1000;
      return DateTime.fromMillisecondsSinceEpoch(ms);
    }
    if (raw is Map) {
      final seconds = raw['seconds'] ?? raw['_seconds'];
      if (seconds is num) {
        return DateTime.fromMillisecondsSinceEpoch(seconds.toInt() * 1000);
      }
    }
    return null;
  }

  NotificationType _typeFromString(String s) {
    switch (s) {
      case 'chat' || 'chat_message' || 'dm_message':
        return NotificationType.chat;
      case 'activity' ||
          'activity_reminder' ||
          'activity_updated' ||
          'activity_cancelled' ||
          'activity_completed' ||
          'activity_left':
        return NotificationType.activity;
      case 'request' ||
          'activity_interest' ||
          'activity_joined' ||
          'join_request':
        return NotificationType.request;
      case 'moderation' || 'participant_removed':
        return NotificationType.moderation;
      default:
        return NotificationType.system;
    }
  }
}
