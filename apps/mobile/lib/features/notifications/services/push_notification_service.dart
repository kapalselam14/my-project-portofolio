import 'dart:async';
import 'dart:io' show Platform;
import 'dart:math';

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../data/device_repository.dart';
import '../domain/device_record.dart';
import 'push_routing.dart';

/// Wraps Firebase Cloud Messaging setup so the rest of the app doesn't have to know whether Firebase has been.
/// The service degrades gracefully on every failure mode the project cares about:
/// No `firebase_options.dart` / `google-services.json` / `GoogleService- Info.plist` installed.
/// The stable device id is generated on first launch and persisted in `SharedPreferences` so a token rotation doesn't.
class PushNotificationService {
  PushNotificationService._();

  static final PushNotificationService instance = PushNotificationService._();

  static const String _deviceIdPrefsKey = 'push_notification_device_id';

  bool _initialised = false;

  /// Taps on system-tray notifications (background/killed + the cold- start message).
  static final StreamController<PushPayload> _openedController =
      StreamController<PushPayload>.broadcast();
  static Stream<PushPayload> get onNotificationOpened =>
      _openedController.stream;

  /// Foreground messages (the OS does not banner these).
  static final StreamController<PushPayload> _foregroundController =
      StreamController<PushPayload>.broadcast();
  static Stream<PushPayload> get onForegroundMessage =>
      _foregroundController.stream;

  /// Test hook — pushes a payload through the opened stream without Firebase.
  @visibleForTesting
  static void debugEmitOpened(PushPayload payload) {
    if (!_openedController.isClosed) _openedController.add(payload);
  }

  /// Initialises Firebase Messaging, requests permission, and registers the current device with the backend's.
  /// Safe to call multiple times — subsequent calls are no-ops.
  Future<void> initialize({required DeviceRepository deviceRepository}) async {
    if (_initialised) return;
    _initialised = true;

    try {
      // Probe whether Firebase has been initialised.
      if (Firebase.apps.isEmpty) {
        debugPrint(
          '[PushNotificationService] Firebase not initialised — skipping FCM setup. '
          'Run `flutterfire configure` and call Firebase.initializeApp() to enable.',
        );
        return;
      }

      final messaging = FirebaseMessaging.instance;

      // Ask the user. On Android 13+ this surfaces the OS prompt.
      final settings = await messaging.requestPermission(
        alert: true,
        badge: true,
        sound: true,
      );
      debugPrint(
        '[PushNotificationService] Permission status: ${settings.authorizationStatus.name}',
      );

      // Fetch the device's FCM token.
      final token = await messaging.getToken();
      if (token == null || token.isEmpty) {
        debugPrint('[PushNotificationService] No FCM token available yet');
        return;
      }
      await _registerWithBackend(token, deviceRepository);

      // Listen for token rotations.
      FirebaseMessaging.instance.onTokenRefresh.listen((newToken) {
        // Fire-and-forget — failures are caught inside the repository.
        unawaited(_registerWithBackend(newToken, deviceRepository));
      });

      // Foreground messages.
      FirebaseMessaging.onMessage.listen((RemoteMessage message) {
        debugPrint(
          '[PushNotificationService] Foreground message: '
          '${message.notification?.title ?? message.data}',
        );
        final payload = PushPayload.parse(
          message.data,
          title: message.notification?.title,
        );
        if (payload != null && !_foregroundController.isClosed) {
          _foregroundController.add(payload);
        }
      });

      // Taps on system-tray notifications (app backgrounded), plus the cold-start message when the app was killed.
      FirebaseMessaging.onMessageOpenedApp.listen((RemoteMessage message) {
        final payload = PushPayload.parse(
          message.data,
          title: message.notification?.title,
        );
        if (payload != null && !_openedController.isClosed) {
          _openedController.add(payload);
        }
      });
      FirebaseMessaging.instance.getInitialMessage().then((message) {
        if (message == null) return;
        final payload = PushPayload.parse(
          message.data,
          title: message.notification?.title,
        );
        if (payload != null && !_openedController.isClosed) {
          _openedController.add(payload);
        }
      });
    } catch (e, st) {
      // Any failure here means FCM is unavailable for this session.
      debugPrint('[PushNotificationService] Initialisation failed: $e\n$st');
    }
  }

  /// Re-registers the current FCM token for the signed-in user.
  Future<void> refreshRegistration({
    required DeviceRepository deviceRepository,
  }) async {
    try {
      if (Firebase.apps.isEmpty) return;
      final token = await FirebaseMessaging.instance.getToken();
      if (token == null || token.isEmpty) {
        debugPrint('[PushNotificationService] No FCM token on refresh');
        return;
      }
      await _registerWithBackend(token, deviceRepository);
    } catch (e, st) {
      debugPrint('[PushNotificationService] Refresh failed: $e\n$st');
    }
  }

  /// Removes this device from the backend's push-notification roster.
  Future<void> unregister({required DeviceRepository deviceRepository}) async {
    try {
      final deviceId = await _getOrCreateDeviceId();
      await deviceRepository.delete(deviceId);
    } catch (e, st) {
      debugPrint('[PushNotificationService] Unregister failed: $e\n$st');
    }
    // The token is no longer trusted by the server.
    try {
      await FirebaseMessaging.instance.deleteToken();
    } catch (e) {
      debugPrint('[PushNotificationService] deleteToken failed: $e');
    }
  }

  Future<void> _registerWithBackend(String token, DeviceRepository repo) async {
    final deviceId = await _getOrCreateDeviceId();
    await repo.register(
      DeviceRecord(
        deviceId: deviceId,
        fcmToken: token,
        platform: _detectPlatform(),
      ),
    );
  }

  /// Returns a stable 32-char hex id for this install, generating and persisting one in `SharedPreferences` on first.
  Future<String> _getOrCreateDeviceId() async {
    final prefs = await SharedPreferences.getInstance();
    final existing = prefs.getString(_deviceIdPrefsKey);
    if (existing != null && existing.isNotEmpty) return existing;

    final rng = Random.secure();
    final bytes = List<int>.generate(16, (_) => rng.nextInt(256));
    final id = bytes.map((b) => b.toRadixString(16).padLeft(2, '0')).join();
    await prefs.setString(_deviceIdPrefsKey, id);
    return id;
  }

  DevicePlatform _detectPlatform() {
    if (kIsWeb) return DevicePlatform.web;
    if (Platform.isIOS) return DevicePlatform.ios;
    if (Platform.isAndroid) return DevicePlatform.android;
    // Desktop fallback — the backend only knows ios/android/web but we have to pick one.
    return DevicePlatform.web;
  }
}
