import 'dart:convert';

import 'package:flutter/services.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:matchup_mobile/core/network/api_client.dart';
import 'package:matchup_mobile/core/providers/auth_state_provider.dart';

/// Cold-start session recovery: an expired ID token must NOT log the
/// user out while a refresh token exists (Firebase ID tokens live
/// 1 hour — without this, every restart after an hour looks like an
/// "automatic logout").
///
/// Secure storage is an in-memory channel mock; the securetoken
/// exchange is injected per test. The `/users/me` probe after a
/// successful refresh hits localhost and fails fast offline, which
/// correctly exercises the fail-open path (stays authenticated).
void main() {
  final backing = <String, String>{};

  setUpAll(() {
    // Plain test() (real async): testWidgets' FakeAsync zone stalls real
    // socket I/O, which the fail-open probe depends on. The channel mock
    // still needs a initialized binding.
    TestWidgetsFlutterBinding.ensureInitialized();
    dotenv.testLoad(fileInput: 'API_BASE_URL=http://localhost:4000');
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(
          const MethodChannel('plugins.it_nomads.com/flutter_secure_storage'),
          (call) async {
            final args =
                (call.arguments as Map?)?.cast<String, dynamic>() ?? const {};
            switch (call.method) {
              case 'read':
                return backing[args['key'] as String];
              case 'write':
                backing[args['key'] as String] = args['value'] as String;
                return null;
              case 'delete':
                backing.remove(args['key'] as String);
                return null;
              case 'deleteAll':
                backing.clear();
                return null;
              default:
                return null;
            }
          },
        );
  });

  setUp(() => backing.clear());

  /// Unsigned JWT — signature is never verified client-side; only the
  /// `exp` claim drives `hasValidSession`.
  String jwt({required int expMs}) {
    String part(Object o) => base64UrlEncode(utf8.encode(jsonEncode(o)));
    final payload = part({'exp': expMs ~/ 1000});
    return '${part({'alg': 'none'})}.$payload.sig';
  }

  Future<void> seed({String? access, String? refresh, String? uid}) async {
    if (access != null) backing['auth_access_token'] = access;
    if (refresh != null) backing['auth_refresh_token'] = refresh;
    if (uid != null) backing['auth_user_id'] = uid;
  }

  group('checkSession cold start', () {
    test(
      'expired ID + live refresh token refreshes silently and stays logged in',
      () async {
        await seed(
          access: jwt(
            expMs: DateTime.now().millisecondsSinceEpoch - 60 * 60 * 1000,
          ),
          refresh: 'live-refresh',
          uid: 'u-1',
        );
        // A real-shaped JWT: the probe's interceptor skips its proactive
        // refresh for fresh tokens, so no real network is attempted.
        final fresh = jwt(
          expMs: DateTime.now().millisecondsSinceEpoch + 60 * 60 * 1000,
        );
        final notifier = AuthStateNotifier(
          exchange: (_) async =>
              SecureTokenPair(idToken: fresh, refreshToken: 'rotated-refresh'),
        );
        addTearDown(notifier.dispose);

        await notifier.checkSession();

        expect(notifier.state.isAuthenticated, isTrue);
        expect(notifier.state.userId, 'u-1');
        expect(backing['auth_access_token'], fresh);
        expect(backing['auth_refresh_token'], 'rotated-refresh');
      },
    );

    test('expired ID with no refresh token logs out', () async {
      await seed(
        access: jwt(expMs: DateTime.now().millisecondsSinceEpoch - 1000),
        uid: 'u-1',
      );
      final notifier = AuthStateNotifier(
        exchange: (_) async => throw StateError('must not be called'),
      );
      addTearDown(notifier.dispose);

      await notifier.checkSession();

      expect(notifier.state.status, AuthStatus.unauthenticated);
    });

    test('rejected refresh token clears storage and logs out', () async {
      await seed(
        access: jwt(expMs: DateTime.now().millisecondsSinceEpoch - 1000),
        refresh: 'dead-refresh',
        uid: 'u-1',
      );
      final notifier = AuthStateNotifier(
        exchange: (_) async =>
            throw const UnrecoverableRefreshException('revoked'),
      );
      addTearDown(notifier.dispose);

      await notifier.checkSession();

      expect(notifier.state.status, AuthStatus.unauthenticated);
      expect(backing, isEmpty);
    });

    test('offline refresh failure fails open (stays logged in)', () async {
      await seed(
        access: jwt(expMs: DateTime.now().millisecondsSinceEpoch - 1000),
        refresh: 'good-refresh',
        uid: 'u-1',
      );
      final notifier = AuthStateNotifier(
        exchange: (_) async => throw const TransientRefreshException('offline'),
      );
      addTearDown(notifier.dispose);

      await notifier.checkSession();

      expect(notifier.state.isAuthenticated, isTrue);
      expect(notifier.state.userId, 'u-1');
      expect(backing['auth_refresh_token'], 'good-refresh');
    });
  });
}
