// Payload carried by an FCM data message, mirrored from the backend's `deliverPush` (`data: {type, activityId?}`).
import '../domain/app_notification.dart';

class PushPayload {
  const PushPayload({
    required this.type,
    this.activityId,
    this.senderUid,
    this.title,
    this.audience,
  });

  /// Backend notification type, e.g. `chat_message`, `activity_completed`.
  final String type;

  /// Related activity, when the notification is about one.
  final String? activityId;

  /// Sender of a 1-on-1 message — the DM thread peer.
  final String? senderUid;

  /// Human-readable title for foreground snackbars.
  final String? title;

  /// Who the notification is for when one type reaches different roles
  /// (`activity_joined`: `host` on instant join, `member` on approval).
  final String? audience;

  /// Parses an FCM `RemoteMessage.data` map (values arrive as `Map<String, dynamic>` from the plugin).
  static PushPayload? parse(Map<String, dynamic> data, {String? title}) {
    final type = data['type']?.toString().trim() ?? '';
    if (type.isEmpty) return null;
    final activityId = data['activityId']?.toString().trim();
    final senderUid = data['senderUid']?.toString().trim();
    final audience = data['audience']?.toString().trim();
    return PushPayload(
      type: type,
      activityId: activityId == null || activityId.isEmpty ? null : activityId,
      senderUid: senderUid == null || senderUid.isEmpty ? null : senderUid,
      title: title,
      audience: audience == null || audience.isEmpty ? null : audience,
    );
  }
}

/// SharedPreferences key for the locally muted group-chat ids (string list of activity ids).
const mutedChatsKey = 'muted_chats';

/// True when a push of this type can change My Games membership or row content.
bool invalidatesMyGames(PushPayload payload) {
  return switch (payload.type) {
    'activity_cancelled' ||
    'activity_completed' ||
    'activity_joined' ||
    'activity_updated' ||
    'activity_left' ||
    'participant_removed' ||
    'join_request' => true,
    _ => false,
  };
}

/// Deep-link route for a parsed payload, or null when the payload has no usable target (unknown type).
String? routeForPush(PushPayload payload) {
  final id = payload.activityId;
  switch (payload.type) {
    case 'chat_message':
      if (id != null) return '/chat/$id';
      return '/notifications';
    case 'dm_message':
      final peer = payload.senderUid;
      if (peer != null) return '/dm/$peer';
      return '/notifications';
    case 'activity_completed':
      if (id != null) return '/past-activity/$id/review';
      return '/notifications';
    case 'join_request':
      if (id != null) return '/manage-activity/$id';
      return '/notifications';
    case 'activity_joined':
      // Same type, two recipients: the host opens management, the approved
      // joiner opens their joined view. Legacy rows lack audience — keep
      // the old discover detail rather than guessing wrong.
      if (id != null) {
        if (payload.audience == 'host') return '/manage-activity/$id';
        if (payload.audience == 'member') return '/joined-activity/$id';
        return '/activity/$id';
      }
      return '/notifications';
    case 'activity_cancelled':
    case 'activity_reminder':
    case 'activity_interest':
    case 'activity_left':
    case 'participant_removed':
      if (id != null) return '/activity/$id';
      return '/notifications';
    case 'activity_updated':
      // Members open their joined view; legacy rows without audience fall back to detail.
      if (id != null) {
        if (payload.audience == 'member') return '/joined-activity/$id';
        return '/activity/$id';
      }
      return '/notifications';
    default:
      // Unknown type — no honest target. The caller no-ops.
      return null;
  }
}

/// Deep-link route for a feed notification, reusing the push table so tray taps and feed taps always agree.
String? routeForNotification(AppNotification notif) {
  return routeForPush(
    PushPayload(
      type: notif.backendType,
      activityId: notif.activityId,
      senderUid: notif.senderUid,
      audience: notif.audience,
    ),
  );
}
