import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';

import 'package:matchup_mobile/core/providers/repository_providers.dart';
import 'package:matchup_mobile/features/notifications/data/notification_repository.dart';
import 'package:matchup_mobile/features/notifications/domain/app_notification.dart';
import 'package:matchup_mobile/features/notifications/presentation/notifications_screen.dart';

class _MockNotificationRepository extends Mock
    implements NotificationRepository {}

void main() {
  late _MockNotificationRepository repo;

  setUp(() {
    repo = _MockNotificationRepository();
    when(() => repo.markRead(any())).thenAnswer((_) async => true);
    when(() => repo.markAllRead()).thenAnswer((_) async => true);
  });

  Future<void> pumpScreen(WidgetTester tester) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [notificationRepositoryProvider.overrideWithValue(repo)],
        child: const MaterialApp(home: NotificationsScreen()),
      ),
    );
    await tester.pumpAndSettle();
  }

  group('NotificationsScreen', () {
    testWidgets('should render notifications grouped under a section header', (
      tester,
    ) async {
      when(() => repo.all()).thenAnswer(
        (_) async => [
          AppNotification(
            id: '1',
            title: 'New message from Alex',
            createdAt: DateTime.now(),
            type: NotificationType.chat,
            unread: true,
          ),
        ],
      );

      await pumpScreen(tester);

      expect(find.text('Notifications'), findsOneWidget);
      expect(find.text('New message from Alex'), findsOneWidget);
      expect(find.text('TODAY'), findsOneWidget);
      expect(find.text('Mark all read'), findsOneWidget);
    });

    testWidgets('should show an empty state when there are no notifications', (
      tester,
    ) async {
      when(() => repo.all()).thenAnswer((_) async => []);

      await pumpScreen(tester);

      expect(find.text('No notifications yet'), findsOneWidget);
    });

    testWidgets('should filter to only unread items on the Unread tab', (
      tester,
    ) async {
      when(() => repo.all()).thenAnswer(
        (_) async => [
          AppNotification(
            id: '1',
            title: 'Read one',
            createdAt: DateTime.now(),
            type: NotificationType.system,
            unread: false,
          ),
          AppNotification(
            id: '2',
            title: 'Unread one',
            createdAt: DateTime.now(),
            type: NotificationType.chat,
            unread: true,
          ),
        ],
      );

      await pumpScreen(tester);
      expect(find.text('Read one'), findsOneWidget);
      expect(find.text('Unread one'), findsOneWidget);

      await tester.tap(find.text('Unread'));
      await tester.pumpAndSettle();

      expect(find.text('Read one'), findsNothing);
      expect(find.text('Unread one'), findsOneWidget);
    });

    testWidgets(
      'should call markAllRead on the repository when "Mark all read" is tapped',
      (tester) async {
        when(() => repo.all()).thenAnswer(
          (_) async => [
            AppNotification(
              id: '1',
              title: 'Unread one',
              createdAt: DateTime.now(),
              type: NotificationType.chat,
              unread: true,
            ),
          ],
        );

        await pumpScreen(tester);
        await tester.tap(find.text('Mark all read'));
        await tester.pumpAndSettle();

        verify(() => repo.markAllRead()).called(1);
      },
    );
  });
}
