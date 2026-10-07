import 'dart:async';

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hive_flutter/hive_flutter.dart';

import 'app/app.dart';
import 'core/config/env.dart';
import 'core/providers/repository_providers.dart';
import 'features/notifications/services/presence_tracker.dart';
import 'features/notifications/services/push_notification_service.dart';
import 'firebase_options.dart';

/// Hive box for the create-activity form draft.
const String _draftBoxName = 'wizard_draft';

/// Top-level background message handler.
@pragma('vm:entry-point')
Future<void> _firebaseBackgroundHandler(RemoteMessage message) async {
  // Background messages don't need to do anything special here — the OS displays the notification.
  if (kDebugMode) {
    debugPrint(
      '[FCM] Background message: ${message.notification?.title ?? message.data}',
    );
  }
}

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // These three inits are independent of each other (env file read, Hive box open, Firebase init).
  await Future.wait([
    Env.load(),
    Hive.initFlutter().then((_) => Hive.openBox(_draftBoxName)),
    (() async {
      // Initialise Firebase with the generated options (project matchup-cs734).
      try {
        await Firebase.initializeApp(
          options: DefaultFirebaseOptions.currentPlatform,
        );
      } catch (e, st) {
        if (kDebugMode) {
          debugPrint('[main] Firebase.initializeApp() failed: $e\n$st');
        }
      }
    })(),
  ]);

  // Register the background handler before runApp so the engine keeps the function reference alive in the background.
  try {
    FirebaseMessaging.onBackgroundMessage(_firebaseBackgroundHandler);
  } catch (e) {
    if (kDebugMode) {
      debugPrint('[main] onBackgroundMessage register failed: $e');
    }
  }

  final container = ProviderContainer();

  // Initialise push notifications after the provider container is built so the device repository can be resolved.
  unawaited(
    PushNotificationService.instance.initialize(
      deviceRepository: container.read(deviceRepositoryProvider),
    ),
  );

  runApp(
    UncontrolledProviderScope(
      container: container,
      // PresenceTracker observes app-lifecycle events.
      child: const PresenceTracker(child: MatchUpApp()),
    ),
  );
}
