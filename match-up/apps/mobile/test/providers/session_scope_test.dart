import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:matchup_mobile/core/providers/auth_state_provider.dart';
import 'package:matchup_mobile/core/providers/preferences_provider.dart';
import 'package:matchup_mobile/core/providers/repository_providers.dart';
import 'package:matchup_mobile/features/discovery/domain/discovery_filter.dart';
import 'package:matchup_mobile/features/discovery/presentation/discovery_screen.dart';

/// Regression test for "logout Benjamin → login Lisa still shows
/// Benjamin's My Games".
///
/// User-scoped repositories hold in-memory caches carrying the viewer's
/// identity (`RemoteActivityRepository._feedCache`,
/// `RemoteUserRepository._meCache`, …). They must be scoped to the
/// signed-in uid so an account switch discards the old instance (and its
/// cache) and every watcher refetches for the new user.
///
/// Same leak class for filter prefs (`sportPreferencesProvider`,
/// `distanceFilterProvider`, `discoveryFilterProvider` + their
/// SharedPreferences keys): covered by the second group below.
void main() {
  setUpAll(() async {
    // Repository providers read Env.useRemoteApi (dotenv.maybeGet),
    // which throws when dotenv was never loaded — same setup as
    // tour_first_run_test.dart.
    await dotenv.load(fileName: '.env.example');
  });

  ProviderContainer createContainer() {
    final container = ProviderContainer();
    addTearDown(container.dispose);
    return container;
  }

  void signInAs(ProviderContainer container, String userId) {
    container.read(authStateProvider.notifier).state = AuthState(
      status: AuthStatus.authenticated,
      userId: userId,
    );
  }

  group('session-scoped repositories', () {
    test('activity repository is recreated on account switch', () {
      final container = createContainer();

      final beforeLogin = container.read(activityRepositoryProvider);
      signInAs(container, 'benjamin');
      final benjamin = container.read(activityRepositoryProvider);
      expect(identical(beforeLogin, benjamin), isFalse);

      // Same uid, status flip only (e.g. suspended) — instance kept.
      container.read(authStateProvider.notifier).state = const AuthState(
        status: AuthStatus.suspended,
        userId: 'benjamin',
      );
      expect(
        identical(benjamin, container.read(activityRepositoryProvider)),
        isTrue,
      );

      // Logout → login as a different user — old instance (and its
      // feed cache) dropped.
      container.read(authStateProvider.notifier).state =
          AuthState.unauthenticated;
      signInAs(container, 'lisa');
      final lisa = container.read(activityRepositoryProvider);
      expect(identical(benjamin, lisa), isFalse);
    });

    test('user/chat/notification/swipes repositories follow the account', () {
      final container = createContainer();
      signInAs(container, 'benjamin');

      final userRepo = container.read(userRepositoryProvider);
      final chatRepo = container.read(chatRepositoryProvider);
      final notifRepo = container.read(notificationRepositoryProvider);
      final swipesRepo = container.read(swipesRepositoryProvider);

      container.read(authStateProvider.notifier).state =
          AuthState.unauthenticated;
      signInAs(container, 'lisa');

      expect(
        identical(userRepo, container.read(userRepositoryProvider)),
        isFalse,
      );
      expect(
        identical(chatRepo, container.read(chatRepositoryProvider)),
        isFalse,
      );
      expect(
        identical(notifRepo, container.read(notificationRepositoryProvider)),
        isFalse,
      );
      expect(
        identical(swipesRepo, container.read(swipesRepositoryProvider)),
        isFalse,
      );
    });
  });

  group('session-scoped filter prefs', () {
    setUp(() {
      SharedPreferences.setMockInitialValues({});
    });

    test('filter prefs reset on switch and restore on return', () async {
      final container = createContainer();
      signInAs(container, 'benjamin');

      // Benjamin sets his prefs (persisted under his per-user keys).
      await container.read(sportPreferencesProvider.notifier).setAll({
        'Tennis': 'Advanced',
      });
      container.read(distanceFilterProvider.notifier).set(20);
      container.read(discoveryFilterProvider.notifier).state =
          const DiscoveryFilter(maxDistanceKm: 20);
      expect(container.read(sportPreferencesProvider), isNotEmpty);
      expect(container.read(distanceFilterProvider), 20);
      expect(container.read(discoveryFilterProvider).isEmpty, isFalse);

      // Lisa logs in: fresh defaults, nothing of Benjamin's leaks.
      signInAs(container, 'lisa');
      expect(container.read(sportPreferencesProvider), isEmpty);
      expect(container.read(distanceFilterProvider), 5.0);
      expect(container.read(discoveryFilterProvider).isEmpty, isTrue);

      // Benjamin returns: his own prefs come back from his keys.
      signInAs(container, 'benjamin');
      for (
        var i = 0;
        i < 50 && container.read(sportPreferencesProvider).isEmpty;
        i++
      ) {
        await Future<void>.delayed(const Duration(milliseconds: 10));
      }
      expect(container.read(sportPreferencesProvider), {'Tennis': 'Advanced'});
    });
  });
}
