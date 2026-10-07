import 'dart:io' show Platform;

import 'package:flutter/foundation.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';

/// Loads runtime configuration from `.env` (or `.env.example` during local development).
class Env {
  static String get apiBaseUrl {
    final raw = dotenv.maybeGet('API_BASE_URL') ?? 'http://localhost:4000';
    final rewritten = _androidEmulatorHost(raw);
    assertHttpsOutsideLocal(rewritten, appEnv);
    return rewritten;
  }

  /// OWASP M5 — fail fast when a non-local build points at cleartext HTTP.
  static void assertHttpsOutsideLocal(String baseUrl, String env) {
    if (env == 'local') return;
    final scheme = Uri.tryParse(baseUrl)?.scheme;
    if (scheme != 'https') {
      throw StateError(
        'API_BASE_URL must use https when APP_ENV is "$env" (got "$baseUrl").',
      );
    }
  }

  /// On Android, `localhost` inside the app is the emulator/device itself — not the dev machine.
  /// Physical devices still need the machine's LAN IP in `.env`.
  static String _androidEmulatorHost(String url) {
    if (kIsWeb) return url;
    if (!Platform.isAndroid) return url;
    final uri = Uri.tryParse(url);
    if (uri == null) return url;
    if (uri.host == 'localhost' || uri.host == '127.0.0.1') {
      return uri.replace(host: '10.0.2.2').toString();
    }
    return url;
  }

  static String get appEnv => dotenv.maybeGet('APP_ENV') ?? 'local';

  /// Firebase Web API Key — used by the Firebase REST Auth API.
  static String get firebaseWebApiKey =>
      dotenv.maybeGet('FIREBASE_WEB_API_KEY') ?? '';

  /// Master switch for backend data.
  static bool get useRemoteApi =>
      (dotenv.maybeGet('USE_REMOTE_API') ?? 'true').toLowerCase() == 'true';

  static Future<void> load() async {
    // Try real `.env` first, fall back to the example for boilerplate runs.
    try {
      await dotenv.load(fileName: '.env');
    } catch (_) {
      await dotenv.load(fileName: '.env.example');
    }
  }
}
