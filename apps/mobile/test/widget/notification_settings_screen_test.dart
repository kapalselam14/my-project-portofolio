import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:matchup_mobile/core/providers/repository_providers.dart';
import 'package:matchup_mobile/features/notifications/data/notification_repository.dart';
import 'package:matchup_mobile/features/notifications/domain/app_notification.dart';
import 'package:matchup_mobile/features/notifications/presentation/notification_settings_screen.dart';

class _MockNotificationRepository extends Mock
    implements NotificationRepository {}

/// The settings screen owns no server state: toggles persist on-device
/// for the two categories the backend actually sends, and the refresh
/// button reports the live unread count best-effort (never a fake
/// endpoint, never a crash).
void main() {
  late _MockNotificationRepository repo;

  setUp(() {
    repo = _MockNotificationRepository();
    SharedPreferences.setMockInitialValues({});
  });

  Future<void> pumpScreen(WidgetTester tester) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [notificationRepositoryProvider.overrideWithValue(repo)],
        child: const MaterialApp(home: NotificationSettingsScreen()),
      ),
    );
    await tester.pumpAndSettle();
  }

  group('NotificationSettingsScreen', () {
    testWidgets('keeps the honest device-only note and two real toggles', (
      tester,
    ) async {
      when(() => repo.unread()).thenAnswer((_) async => []);

      await pumpScreen(tester);

      expect(
        find.text(
          "These preferences are saved on this device only and don't change push delivery yet.",
        ),
        findsOneWidget,
      );
      // Only the two categories the backend actually sends.
      expect(find.text('Game Cancellations'), findsOneWidget);
      expect(find.text('New Messages'), findsOneWidget);
    });

    testWidgets('refresh reports the server unread count', (tester) async {
      when(() => repo.unread()).thenAnswer(
        (_) async => [
          AppNotification(
            id: '1',
            title: 'Hello',
            createdAt: DateTime.now(),
            type: NotificationType.chat,
            unread: true,
          ),
          AppNotification(
            id: '2',
            title: 'World',
            createdAt: DateTime.now(),
            type: NotificationType.chat,
            unread: true,
          ),
        ],
      );

      await pumpScreen(tester);
      await tester.tap(find.text('Refresh from server'));
      await tester.pumpAndSettle();

      verify(() => repo.unread()).called(1);
      expect(find.text('You have 2 unread notifications.'), findsOneWidget);
    });

    testWidgets('refresh failure shows a quiet notice, toggles stay', (
      tester,
    ) async {
      when(() => repo.unread()).thenThrow(Exception('offline'));

      await pumpScreen(tester);
      await tester.tap(find.text('Refresh from server'));
      await tester.pumpAndSettle();

      expect(
        find.text('Could not reach the server — showing device settings.'),
        findsOneWidget,
      );
      expect(find.text('Game Cancellations'), findsOneWidget);
      expect(find.text('New Messages'), findsOneWidget);
    });
  });
}
