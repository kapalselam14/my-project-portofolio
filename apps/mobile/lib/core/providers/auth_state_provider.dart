import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../auth/session_events.dart';
import '../network/api_client.dart';
import '../services/rtdb_auth_service.dart';
import '../storage/secure_token_store.dart';
import '../../features/notifications/data/remote_presence_repository.dart';

// Domain.

enum AuthStatus { unknown, authenticated, unauthenticated, suspended }

/// Outcome of a suspension re-check: [clear] means the account is active again, [suspended] means still suspended.
enum SuspensionCheck { clear, suspended, unknown }

class AuthState {
  const AuthState({this.status = AuthStatus.unknown, this.userId});

  final AuthStatus status;

  /// The stored Firebase UID, or null when unauthenticated.
  final String? userId;

  bool get isAuthenticated => status == AuthStatus.authenticated;
  bool get isUnknown => status == AuthStatus.unknown;
  bool get isSuspended => status == AuthStatus.suspended;

  AuthState copyWith({AuthStatus? status, String? userId}) =>
      AuthState(status: status ?? this.status, userId: userId ?? this.userId);

  static const unauthenticated = AuthState(status: AuthStatus.unauthenticated);
  static const unknown = AuthState(status: AuthStatus.unknown);
}

// Notifier.

class AuthStateNotifier extends StateNotifier<AuthState> {
  AuthStateNotifier({SecureTokenExchange? exchange})
    : _exchange = exchange ?? secureTokenExchange,
      super(AuthState.unknown) {
    // Fired by the API layer when the refresh token itself is dead.
    _expirySub = SessionEvents.instance.onSessionExpired.listen((_) async {
      await _store.clearAll();
      state = AuthState.unauthenticated;
    });
    // Fired by the API layer on 403 ACCOUNT_SUSPENDED.
    _suspendedSub = SessionEvents.instance.onSuspended.listen((_) {
      state = state.copyWith(status: AuthStatus.suspended);
    });
  }

  final _store = SecureTokenStore.instance;

  /// Exchange used by the cold-start silent refresh.
  final SecureTokenExchange _exchange;
  late final StreamSubscription<void> _expirySub;
  late final StreamSubscription<void> _suspendedSub;

  @override
  void dispose() {
    _expirySub.cancel();
    _suspendedSub.cancel();
    super.dispose();
  }

  /// Called at app start (splash screen).
  /// An expired ID token is NOT a logout: Firebase ID tokens live 1 hour while the refresh token lives indefinitely.
  /// Probe semantics (all fail-open except explicit signals): 200 → keep local authenticated status.
  Future<void> checkSession() async {
    final hasSession = await _store.hasValidSession;
    if (!hasSession) {
      // Definitive outcomes set state inside; transient failure fails open to authenticated and also returns false.
      final refreshed = await _silentRefresh();
      if (!refreshed) return;
    }
    final userId = await _store.readUserId();
    state = AuthState(status: AuthStatus.authenticated, userId: userId);
    // Restore the SDK session too so realtime listeners.
    unawaited(RtdbAuthService.instance.ensureSignedIn());
    try {
      await ApiClient.instance.dio
          .get('/users/me')
          .timeout(const Duration(seconds: 3));
    } on DioException catch (e) {
      final code = e.response?.statusCode;
      final errBody = e.response?.data;
      final errMap = errBody is Map ? errBody['error'] : null;
      final errCode = errMap is Map ? errMap['code'] : null;
      if (code == 403 && errCode == 'ACCOUNT_SUSPENDED') {
        state = state.copyWith(status: AuthStatus.suspended);
        return;
      }
      if (code == 401) {
        await _store.clearAll();
        state = AuthState.unauthenticated;
        return;
      }
      final wrapped = e.error;
      if (wrapped is ApiException) {
        if (wrapped.isAccountSuspended) {
          state = state.copyWith(status: AuthStatus.suspended);
          return;
        }
        if (wrapped.statusCode == 401) {
          await _store.clearAll();
          state = AuthState.unauthenticated;
          return;
        }
      }
      // Any other Dio error (offline/timeout/5xx) → fail open.
    } catch (_) {
      // TimeoutException, network errors, unexpected shapes → fail open, keep the local authenticated status.
    }
  }

  /// One silent refresh attempt for cold starts whose ID token expired.
  Future<bool> _silentRefresh() async {
    final refreshToken = await _store.readRefreshToken();
    final userId = await _store.readUserId();
    if (refreshToken == null ||
        refreshToken.isEmpty ||
        userId == null ||
        userId.isEmpty) {
      state = AuthState.unauthenticated;
      return false;
    }
    try {
      final pair = await _exchange(refreshToken);
      await _store.saveAccessToken(pair.idToken);
      final rotated = pair.refreshToken;
      if (rotated != null && rotated.isNotEmpty) {
        await _store.saveRefreshToken(rotated);
      }
      return true;
    } on UnrecoverableRefreshException {
      // Refresh token rejected/revoked (or user disabled): the session is genuinely dead.
      await _store.clearAll();
      state = AuthState.unauthenticated;
      return false;
    } catch (_) {
      // Offline/transient: stay logged in locally.
      state = AuthState(status: AuthStatus.authenticated, userId: userId);
      return false;
    }
  }

  /// Called after successful Firebase REST sign-in/register.
  Future<void> signIn({
    required String accessToken, // Firebase ID token
    required String refreshToken, // Firebase refresh token
    required String userId, // Firebase UID (localId)
  }) async {
    await Future.wait([
      _store.saveAccessToken(accessToken),
      _store.saveRefreshToken(refreshToken),
      _store.saveUserId(userId),
    ]);
    state = AuthState(status: AuthStatus.authenticated, userId: userId);
    // Sign the Firebase SDK in as the same user so RTDB listeners are authenticated.
    unawaited(RtdbAuthService.instance.ensureSignedIn());
  }

  /// Clears all stored tokens and sets state to unauthenticated.
  Future<void> signOut() async {
    // Tell the backend we're going offline BEFORE the tokens are cleared (the write needs the session).
    try {
      await RemotePresenceRepository.markOfflineNow().timeout(
        const Duration(seconds: 3),
        onTimeout: () {},
      );
    } catch (_) {}
    await _store.clearAll();
    // Drop the SDK session too so the next account doesn't inherit it.
    unawaited(RtdbAuthService.instance.signOut());
    state = AuthState.unauthenticated;
  }

  /// Re-checks a suspension (the interstitial's "Check again" action).
  Future<SuspensionCheck> refreshSuspension() async {
    try {
      await ApiClient.instance.dio.get('/users/me');
      state = state.copyWith(status: AuthStatus.authenticated);
      return SuspensionCheck.clear;
    } on DioException catch (e) {
      final code = e.response?.statusCode;
      final errBody = e.response?.data;
      final errMap = errBody is Map ? errBody['error'] : null;
      final errCode = errMap is Map ? errMap['code'] : null;
      if (code == 403 && errCode == 'ACCOUNT_SUSPENDED') {
        state = state.copyWith(status: AuthStatus.suspended);
        return SuspensionCheck.suspended;
      }
      final wrapped = e.error;
      if (wrapped is ApiException) {
        if (wrapped.isAccountSuspended) {
          state = state.copyWith(status: AuthStatus.suspended);
          return SuspensionCheck.suspended;
        }
      }
      return SuspensionCheck.unknown;
    } catch (_) {
      return SuspensionCheck.unknown;
    }
  }
}

// Providers.

final authStateProvider = StateNotifierProvider<AuthStateNotifier, AuthState>(
  (ref) => AuthStateNotifier(),
);

final authStatusProvider = Provider<AuthStatus>(
  (ref) => ref.watch(authStateProvider).status,
);

final isAuthenticatedProvider = Provider<bool>(
  (ref) => ref.watch(authStateProvider).isAuthenticated,
);
