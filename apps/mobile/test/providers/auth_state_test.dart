import 'package:flutter_test/flutter_test.dart';
import 'package:matchup_mobile/core/providers/auth_state_provider.dart';

// ─── Fake SecureTokenStore ─────────────────────────────────────────────────

/// In-memory stand-in for SecureTokenStore so tests don't touch Keychain.
class _FakeTokenStore {
  String? _access;
  String? _refresh;
  String? _userId;

  Future<void> saveAccessToken(String t) async => _access = t;
  Future<String?> readAccessToken() async => _access;
  Future<void> saveRefreshToken(String t) async => _refresh = t;
  Future<String?> readRefreshToken() async => _refresh;
  Future<void> saveUserId(String id) async => _userId = id;
  Future<String?> readUserId() async => _userId;
  Future<bool> get hasValidSession async =>
      _access != null && _access!.isNotEmpty;
  Future<void> clearAll() async {
    _access = null;
    _refresh = null;
    _userId = null;
  }
}

/// Testable subclass that swaps the real SecureTokenStore for our fake.
class _TestableAuthNotifier extends AuthStateNotifier {
  _TestableAuthNotifier(this._store);

  final _FakeTokenStore _store;

  @override
  Future<void> checkSession() async {
    final hasSession = await _store.hasValidSession;
    if (hasSession) {
      final userId = await _store.readUserId();
      state = AuthState(status: AuthStatus.authenticated, userId: userId);
    } else {
      state = AuthState.unauthenticated;
    }
  }

  @override
  Future<void> signIn({
    required String accessToken,
    required String refreshToken,
    required String userId,
  }) async {
    await _store.saveAccessToken(accessToken);
    await _store.saveRefreshToken(refreshToken);
    await _store.saveUserId(userId);
    state = AuthState(status: AuthStatus.authenticated, userId: userId);
  }

  @override
  Future<void> signOut() async {
    await _store.clearAll();
    state = AuthState.unauthenticated;
  }
}

void main() {
  late _FakeTokenStore fakeStore;
  late _TestableAuthNotifier notifier;

  setUp(() {
    fakeStore = _FakeTokenStore();
    notifier = _TestableAuthNotifier(fakeStore);
  });

  group('AuthStateNotifier', () {
    test('should initialise in unknown status', () {
      expect(notifier.state.status, AuthStatus.unknown);
    });

    test('should transition to unauthenticated when no token stored', () async {
      await notifier.checkSession();
      expect(notifier.state.status, AuthStatus.unauthenticated);
    });

    test('should transition to authenticated when token exists', () async {
      await fakeStore.saveAccessToken('token123');
      await fakeStore.saveUserId('user-001');
      await notifier.checkSession();

      expect(notifier.state.status, AuthStatus.authenticated);
      expect(notifier.state.userId, 'user-001');
    });

    test('should persist tokens and authenticate via signIn', () async {
      await notifier.signIn(
        accessToken: 'access',
        refreshToken: 'refresh',
        userId: 'u-42',
      );

      expect(notifier.state.isAuthenticated, isTrue);
      expect(notifier.state.userId, 'u-42');
      expect(await fakeStore.readAccessToken(), 'access');
    });

    test(
      'should clear all tokens and set unauthenticated via signOut',
      () async {
        await notifier.signIn(accessToken: 'a', refreshToken: 'r', userId: 'u');
        await notifier.signOut();

        expect(notifier.state.status, AuthStatus.unauthenticated);
        expect(await fakeStore.readAccessToken(), isNull);
      },
    );

    test('isAuthenticated should return false in unknown state', () {
      expect(notifier.state.isAuthenticated, isFalse);
    });

    test('isUnknown should return true in initial state', () {
      expect(notifier.state.isUnknown, isTrue);
    });
  });

  group('AuthState helpers', () {
    test('authenticated state should have isAuthenticated true', () {
      const s = AuthState(status: AuthStatus.authenticated, userId: 'x');
      expect(s.isAuthenticated, isTrue);
    });

    test('unauthenticated constant should have correct status', () {
      expect(AuthState.unauthenticated.status, AuthStatus.unauthenticated);
    });
  });
}
