import 'local_storage.dart';

/// Persists the last visited route so the app resumes where the user left off.
/// Auth routes are never persisted (no session to resume with).
class RouteStore {
  RouteStore._();
  static final RouteStore instance = RouteStore._();

  static const _key = 'last_route';

  /// Paths that must never be stored as a resume point.
  static const _excluded = {
    '/splash',
    '/suspended',
    '/onboarding',
    '/welcome',
    '/login',
    '/register',
    '/forgot-password',
    '/reset-link-sent',
    '/get-to-know-1',
    '/get-to-know-2',
    '/get-to-know-3',
  };

  /// Tab roots that are safe to resume into.
  static const _tabRoots = {
    '/discovery',
    '/activities',
    '/create',
    '/messages',
    '/profile',
  };

  static bool _isAllowed(String location) {
    if (_tabRoots.contains(location)) return true;
    // Activity detail family: /activity/:id and its sub-routes.
    if (location == '/activity' || location.startsWith('/activity/')) {
      return true;
    }
    return false;
  }

  Future<void> save(String location) async {
    if (_excluded.any((p) => location == p || location.startsWith('$p/'))) {
      return;
    }
    if (!_isAllowed(location)) return;
    final storage = await LocalStorage.create();
    await storage.setString(_key, location);
  }

  Future<String?> read() async {
    final storage = await LocalStorage.create();
    return storage.getString(_key);
  }

  Future<void> clear() async {
    final storage = await LocalStorage.create();
    await storage.remove(_key);
  }
}
