import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:matchup_mobile/core/providers/repository_providers.dart';
import 'package:matchup_mobile/features/notifications/data/notification_repository.dart';
import 'package:matchup_mobile/features/notifications/domain/app_notification.dart';
import 'package:matchup_mobile/features/notifications/presentation/notifications_screen.dart';
import 'package:mocktail/mocktail.dart';

class _MockNotificationRepository extends Mock
    implements NotificationRepository {}

AppNotification _notif({
  required String id,
  required String title,
  required String backendType,
  String? activityId,
}) {
  return AppNotification(
    id: id,
    title: title,
    createdAt: DateTime(2026, 9, 10, 12),
    type: NotificationType.system,
    unread: true,
    backendType: backendType,
    activityId: activityId,
  );
}

Future<void> _pump(
  WidgetTester tester,
  _MockNotificationRepository repo,
  List<AppNotification> notifs,
) async {
  when(() => repo.all()).thenAnswer((_) async => notifs);
  when(() => repo.markRead(any())).thenAnswer((_) async => true);
  final router = GoRouter(
    initialLocation: '/notifications',
    routes: [
      GoRoute(
        path: '/notifications',
        builder: (_, _) => const NotificationsScreen(),
      ),
      GoRoute(
        path: '/chat/:id',
        builder: (_, state) =>
            Scaffold(body: Text('Chat ${state.pathParameters['id']}')),
      ),
    ],
  );
  await tester.pumpWidget(
    ProviderScope(
      overrides: [notificationRepositoryProvider.overrideWithValue(repo)],
      child: MaterialApp.router(routerConfig: router),
    ),
  );
  await tester.pumpAndSettle();
}

void main() {
  late _MockNotificationRepository repo;

  setUp(() => repo = _MockNotificationRepository());

  testWidgets('chat notification tap marks read and opens the chat', (
    tester,
  ) async {
    await _pump(tester, repo, [
      _notif(
        id: 'n-1',
        title: 'New message',
        backendType: 'chat_message',
        activityId: 'a-1',
      ),
    ]);

    await tester.tap(find.text('New message'));
    await tester.pumpAndSettle();

    verify(() => repo.markRead('n-1')).called(1);
    expect(find.text('Chat a-1'), findsOneWidget);
  });

  testWidgets('system notification tap marks read and opens the full message', (
    tester,
  ) async {
    await _pump(tester, repo, [
      _notif(id: 'n-2', title: 'Welcome!', backendType: 'system'),
    ]);

    await tester.tap(find.text('Welcome!'));
    await tester.pumpAndSettle();

    verify(() => repo.markRead('n-2')).called(1);
    // Target-less notifications open the full-message sheet (title +
    // body) instead of navigating away from the feed.
    expect(find.text('No additional details.'), findsOneWidget);
    expect(find.text('Chat a-1'), findsNothing);
  });
}
