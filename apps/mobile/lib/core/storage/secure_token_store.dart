import 'dart:convert';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Keys for secure token storage.
const _kAccessToken = 'auth_access_token';
const _kRefreshToken = 'auth_refresh_token';
const _kUserId = 'auth_user_id';

/// Per-account "get-to-know onboarding done" prefs key.
String gtkDoneKeyFor(String uid) => 'gtk_done_$uid';

/// Stores and retrieves auth tokens using the platform secure enclave (Keychain on iOS, Keystore-backed.
/// NEVER store tokens in [SharedPreferences] or Hive without encryption.
class SecureTokenStore {
  SecureTokenStore._()
    : _storage = const FlutterSecureStorage(
        // Usage: see the constructors below.
        aOptions: AndroidOptions(),
        iOptions: IOSOptions(accessibility: KeychainAccessibility.first_unlock),
      );

  static final SecureTokenStore instance = SecureTokenStore._();

  final FlutterSecureStorage _storage;

  // Access token.

  Future<void> saveAccessToken(String token) =>
      _storage.write(key: _kAccessToken, value: token);

  Future<String?> readAccessToken() => _storage.read(key: _kAccessToken);

  // Refresh token.

  Future<void> saveRefreshToken(String token) =>
      _storage.write(key: _kRefreshToken, value: token);

  Future<String?> readRefreshToken() => _storage.read(key: _kRefreshToken);

  // User ID.

  Future<void> saveUserId(String id) =>
      _storage.write(key: _kUserId, value: id);

  Future<String?> readUserId() => _storage.read(key: _kUserId);

  // Session helpers.

  Future<bool> get hasValidSession async {
    final token = await readAccessToken();
    if (token == null || token.isEmpty) return false;
    // Client-side convenience check only (no signature verification.
    final expMs = _jwtExpiryMs(token);
    if (expMs == null) return true;
    const leewayMs = 60 * 1000;
    return DateTime.now().millisecondsSinceEpoch + leewayMs < expMs;
  }

  /// Epoch-millis `exp` of a JWT payload without verifying its signature.
  static int? _jwtExpiryMs(String token) {
    try {
      final parts = token.split('.');
      if (parts.length != 3) return null;
      var payload = parts[1].replaceAll('-', '+').replaceAll('_', '/');
      payload += '=' * ((4 - payload.length % 4) % 4);
      final json =
          jsonDecode(utf8.decode(base64.decode(payload)))
              as Map<String, dynamic>;
      final exp = json['exp'];
      if (exp is num) return exp.toInt() * 1000;
      return null;
    } catch (_) {
      return null;
    }
  }

  /// Call on logout. Deletes ALL stored tokens.
  Future<void> clearAll() async {
    await Future.wait([
      _storage.delete(key: _kAccessToken),
      _storage.delete(key: _kRefreshToken),
      _storage.delete(key: _kUserId),
    ]);
  }
}
