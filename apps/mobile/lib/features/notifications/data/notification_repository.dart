import '../domain/app_notification.dart';

abstract class NotificationRepository {
  Future<List<AppNotification>> all();
  Future<List<AppNotification>> unread();

  /// Marks one notification read.
  Future<bool> markRead(String id);

  /// Marks everything read.
  Future<bool> markAllRead();
}
