import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';

import '../../../core/config/env.dart';
import '../../../core/network/api_client.dart';
import '../../../core/storage/secure_token_store.dart';
import 'auth_repository.dart';

/// Firebase Auth REST API base URL.
const _firebaseAuthBase = 'https://identitytoolkit.googleapis.com/v1/accounts';

/// HTTP-backed [AuthRepository] using the Firebase Authentication REST API.
/// No Firebase Flutter SDK required — all calls go through plain HTTP.
/// Flow: signIn/register → Firebase REST → store idToken + refreshToken.
class RemoteAuthRepository implements AuthRepository {
  RemoteAuthRepository({Dio? firebaseClient, ApiClient? apiClient})
    : _fb = firebaseClient ?? _buildFirebaseDio(),
      _api = apiClient ?? ApiClient.instance;

  final Dio _fb;
  final ApiClient _api;

  static Dio _buildFirebaseDio() => Dio(
    BaseOptions(
      connectTimeout: const Duration(seconds: 12),
      receiveTimeout: const Duration(seconds: 12),
      headers: {'Content-Type': 'application/json'},
    ),
  );

  String get _key => Env.firebaseWebApiKey;

  // AuthRepository.

  @override
  Future<AuthResult> signIn({
    required String email,
    required String password,
  }) async {
    try {
      final res = await _fb.post(
        '$_firebaseAuthBase:signInWithPassword?key=$_key',
        data: {
          'email': email.trim(),
          'password': password,
          'returnSecureToken': true,
        },
      );
      final result = _parseFirebaseResult(res.data as Map<String, dynamic>);
      // Self-heal accounts whose Firestore profile is missing.
      await _ensureBackendProfile(result);
      return result;
    } on DioException catch (e) {
      throw _toAuthException(e);
    } catch (e) {
      debugPrint('[RemoteAuthRepository.signIn] unexpected: $e');
      throw const AuthException('Sign in failed. Please try again.');
    }
  }

  @override
  Future<AuthResult> register({
    required String name,
    required String email,
    required String password,
  }) async {
    try {
      // 1. Create Firebase user
      final res = await _fb.post(
        '$_firebaseAuthBase:signUp?key=$_key',
        data: {
          'email': email.trim(),
          'password': password,
          'returnSecureToken': true,
        },
      );
      final result = _parseFirebaseResult(res.data as Map<String, dynamic>);

      // 2. Set display name via updateProfile
      try {
        await _fb.post(
          '$_firebaseAuthBase:update?key=$_key',
          data: {
            'idToken': result.accessToken,
            'displayName': name.trim(),
            'returnSecureToken': false,
          },
        );
      } catch (e) {
        // Non-fatal — display name update can fail silently
        debugPrint(
          '[RemoteAuthRepository.register] displayName update failed: $e',
        );
      }

      // Bootstrap the user document in the backend's Firestore.
      await _ensureBackendProfile(
        result,
        email: email.trim().toLowerCase(),
        // The bootstrap only stores authUid + email.
        displayName: name.trim(),
      );

      return result;
    } on DioException catch (e) {
      throw _toAuthException(e);
    } catch (e) {
      debugPrint('[RemoteAuthRepository.register] unexpected: $e');
      throw const AuthException('Registration failed. Please try again.');
    }
  }

  @override
  Future<void> forgotPassword({required String email}) async {
    try {
      // Firebase email/password reset is link-based.
      await _fb.post(
        '$_firebaseAuthBase:sendOobCode?key=$_key',
        data: {'requestType': 'PASSWORD_RESET', 'email': email.trim()},
      );
    } on DioException catch (e) {
      throw _toAuthException(e);
    } catch (e) {
      debugPrint('[RemoteAuthRepository.forgotPassword] unexpected: $e');
      throw const AuthException(
        'Could not send reset email. Please try again.',
      );
    }
  }

  @override
  Future<void> signOut() async {
    // Firebase REST API has no server-side sign-out — tokens are cleared locally by AuthStateNotifier.signOut().
  }

  // Helpers.

  /// Persists [result]'s tokens, then ensures the Firestore user profile exists via idempotent `POST /api/users/me`.
  Future<void> _ensureBackendProfile(
    AuthResult result, {
    String? email,
    String? displayName,
  }) async {
    try {
      await Future.wait([
        SecureTokenStore.instance.saveAccessToken(result.accessToken),
        SecureTokenStore.instance.saveRefreshToken(result.refreshToken),
        SecureTokenStore.instance.saveUserId(result.userId),
      ]);
      await _api.dio.post('/users/me', data: {'email': ?email});
      if (displayName != null && displayName.isNotEmpty) {
        await _api.dio.patch('/users/me', data: {'displayName': displayName});
      }
    } catch (e) {
      debugPrint('[RemoteAuthRepository] backend profile ensure failed: $e');
    }
  }

  AuthResult _parseFirebaseResult(Map<String, dynamic> json) {
    final idToken = json['idToken'] as String?;
    final refreshToken = json['refreshToken'] as String?;
    final localId = json['localId'] as String?; // Firebase UID

    if (idToken == null || refreshToken == null || localId == null) {
      throw const AuthException(
        'Unexpected response from auth server.',
        code: 'PARSE_ERROR',
      );
    }

    return AuthResult(
      accessToken: idToken,
      refreshToken: refreshToken,
      userId: localId,
    );
  }

  AuthException _toAuthException(DioException e) {
    // Firebase REST errors: { "error": { "message": "EMAIL_NOT_FOUND" } } Message sometimes has suffix detail:.
    final data = e.response?.data;
    final rawMsg = data is Map
        ? (data['error'] as Map?)?.tryGet<String>('message')
        : null;

    // Strip suffix after ' : ' so matching is stable regardless of Firebase appending extra detail.
    final firebaseCode = rawMsg?.split(' : ').first.trim();

    final userMsg = switch (firebaseCode) {
      'EMAIL_NOT_FOUND' ||
      'INVALID_PASSWORD' ||
      'INVALID_LOGIN_CREDENTIALS' => 'Incorrect email or password.',
      'EMAIL_EXISTS' => 'An account with this email already exists.',
      'WEAK_PASSWORD' => 'Password must be at least 6 characters.',
      'INVALID_EMAIL' => 'Please enter a valid email address.',
      'USER_DISABLED' => 'This account has been disabled.',
      'TOO_MANY_ATTEMPTS_TRY_LATER' =>
        'Too many attempts. Please try again later.',
      'MISSING_PASSWORD' => 'Password is required.',
      'MISSING_EMAIL' => 'Email is required.',
      'USER_NOT_FOUND' => 'Account not found.',
      'TOKEN_EXPIRED' ||
      'INVALID_ID_TOKEN' => 'Session expired. Please sign in again.',
      _
          when e.type == DioExceptionType.connectionError ||
              e.type == DioExceptionType.connectionTimeout =>
        'Cannot reach the server. Check your internet connection.',
      _ => 'Authentication failed. Please try again.',
    };

    return AuthException(userMsg, code: firebaseCode);
  }
}

// Extension helpers.

extension _MapTryGet on Map {
  T? tryGet<T>(String key) {
    final v = this[key];
    return v is T ? v : null;
  }
}
