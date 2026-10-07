import 'package:flutter_test/flutter_test.dart';
import 'package:matchup_mobile/features/notifications/domain/app_notification.dart';
import 'package:matchup_mobile/features/notifications/services/push_routing.dart';

AppNotification _notif({
  String backendType = 'system',
  String? activityId,
  String? senderUid,
  String? audience,
}) {
  return AppNotification(
    id: 'n-1',
    title: 'T',
    createdAt: DateTime(2026, 9, 1),
    type: NotificationType.system,
    backendType: backendType,
    activityId: activityId,
    senderUid: senderUid,
    audience: audience,
  );
}

void main() {
  group('PushPayload.parse', () {
    test('parses type + activityId', () {
      final p = PushPayload.parse({
        'type': 'chat_message',
        'activityId': 'a-1',
      }, title: 'Hi');
      expect(p, isNotNull);
      expect(p!.type, 'chat_message');
      expect(p.activityId, 'a-1');
      expect(p.title, 'Hi');
    });

    test('returns null without a type', () {
      expect(PushPayload.parse({}), isNull);
      expect(PushPayload.parse({'type': '  '}), isNull);
    });

    test('trims values and drops empty activityId', () {
      final p = PushPayload.parse({'type': ' system ', 'activityId': '  '});
      expect(p, isNotNull);
      expect(p!.type, 'system');
      expect(p.activityId, isNull);
    });
  });

  group('routeForPush', () {
    test('chat_message goes to the chat', () {
      expect(
        routeForPush(
          const PushPayload(type: 'chat_message', activityId: 'a-1'),
        ),
        '/chat/a-1',
      );
    });

    test('activity_completed goes to the review screen', () {
      expect(
        routeForPush(
          const PushPayload(type: 'activity_completed', activityId: 'a-2'),
        ),
        '/past-activity/a-2/review',
      );
    });

    test('join_request goes to manage', () {
      expect(
        routeForPush(
          const PushPayload(type: 'join_request', activityId: 'a-3'),
        ),
        '/manage-activity/a-3',
      );
    });

    test('activity events go to detail', () {
      expect(
        routeForPush(
          const PushPayload(type: 'activity_joined', activityId: 'a-4'),
        ),
        '/activity/a-4',
      );
    });

    test('activity_joined routes by audience', () {
      // Host (instant join) opens management, not the discover detail.
      expect(
        routeForPush(
          const PushPayload(
            type: 'activity_joined',
            activityId: 'a-4',
            audience: 'host',
          ),
        ),
        '/manage-activity/a-4',
      );
      // Approved joiner opens their joined view.
      expect(
        routeForPush(
          const PushPayload(
            type: 'activity_joined',
            activityId: 'a-4',
            audience: 'member',
          ),
        ),
        '/joined-activity/a-4',
      );
    });

    test('activity_updated routes members to their joined view', () {
      expect(
        routeForPush(
          const PushPayload(
            type: 'activity_updated',
            activityId: 'a-5',
            audience: 'member',
          ),
        ),
        '/joined-activity/a-5',
      );
      // Legacy rows without audience keep the discover detail.
      expect(
        routeForPush(
          const PushPayload(type: 'activity_updated', activityId: 'a-5'),
        ),
        '/activity/a-5',
      );
    });

    test('missing activityId falls back to notifications feed', () {
      expect(
        routeForPush(const PushPayload(type: 'chat_message')),
        '/notifications',
      );
    });

    test('unknown types have no route (callers no-op)', () {
      expect(routeForPush(const PushPayload(type: 'system')), isNull);
      expect(routeForPush(const PushPayload(type: 'totally_unknown')), isNull);
    });
  });
  group('dm_message routing', () {
    test('parses senderUid', () {
      final p = PushPayload.parse({
        'type': 'dm_message',
        'senderUid': 'u-9',
      }, title: 'New message from Sam');
      expect(p, isNotNull);
      expect(p!.senderUid, 'u-9');
    });

    test('dm_message goes to the DM thread', () {
      expect(
        routeForPush(const PushPayload(type: 'dm_message', senderUid: 'u-9')),
        '/dm/u-9',
      );
    });

    test('dm_message without sender falls back to feed', () {
      expect(
        routeForPush(const PushPayload(type: 'dm_message')),
        '/notifications',
      );
    });
  });

  group('routeForNotification', () {
    test('feed and tray taps agree per backend type', () {
      expect(
        routeForNotification(
          _notif(backendType: 'chat_message', activityId: 'a-1'),
        ),
        '/chat/a-1',
      );
      expect(
        routeForNotification(
          _notif(backendType: 'dm_message', senderUid: 'u-9'),
        ),
        '/dm/u-9',
      );
      expect(
        routeForNotification(
          _notif(backendType: 'activity_completed', activityId: 'a-2'),
        ),
        '/past-activity/a-2/review',
      );
      expect(
        routeForNotification(
          _notif(backendType: 'join_request', activityId: 'a-3'),
        ),
        '/manage-activity/a-3',
      );
      // Same display type, different screens: activity_joined routes by
      // audience (host → manage, member → joined, legacy → detail).
      expect(
        routeForNotification(
          _notif(backendType: 'activity_joined', activityId: 'a-4'),
        ),
        '/activity/a-4',
      );
      expect(
        routeForNotification(
          _notif(
            backendType: 'activity_joined',
            activityId: 'a-4',
            audience: 'host',
          ),
        ),
        '/manage-activity/a-4',
      );
      expect(
        routeForNotification(
          _notif(
            backendType: 'activity_joined',
            activityId: 'a-4',
            audience: 'member',
          ),
        ),
        '/joined-activity/a-4',
      );
    });

    test('returns null without a usable target', () {
      expect(routeForNotification(_notif()), isNull);
      expect(
        routeForNotification(_notif(backendType: 'chat_message')),
        '/notifications',
      );
    });
  });

  group('invalidatesMyGames', () {
    test('membership-changing pushes qualify', () {
      for (final type in [
        'activity_cancelled',
        'activity_completed',
        'activity_joined',
        'activity_updated',
        'activity_left',
        'participant_removed',
        'join_request',
      ]) {
        expect(
          invalidatesMyGames(PushPayload(type: type, activityId: 'a-1')),
          isTrue,
          reason: type,
        );
      }
    });

    test('chat/system pushes do not qualify', () {
      for (final type in [
        'chat_message',
        'dm_message',
        'activity_interest',
        'activity_reminder',
        'system',
        'totally_unknown',
      ]) {
        expect(
          invalidatesMyGames(PushPayload(type: type, activityId: 'a-1')),
          isFalse,
          reason: type,
        );
      }
    });
  });
}
