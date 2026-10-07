import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../storage/local_storage.dart';
import '../utils/logger.dart';
import 'auth_state_provider.dart';

// Keys.

const _kSportPrefs = 'pref_sport_skills_v1';
const _kDistance = 'pref_distance_km_v1';
const _kPrice = 'pref_price_mode_v1';

// User scoping.
// Filter prefs must not leak across accounts (logout Benjamin → login Lisa showed Benjamin's sports filter.
String _keyFor(String base, String? uid) => '${base}_${uid ?? 'anon'}';

// Sport preferences.

/// Persists the user's sport + skill preferences.
/// Key: sport name (e.g.
/// Values are stored as a JSON-encoded map in SharedPreferences.
final sportPreferencesProvider =
    StateNotifierProvider<SportPreferencesNotifier, Map<String, String>>((ref) {
      final uid = ref.watch(authStateProvider.select((s) => s.userId));
      return SportPreferencesNotifier(uid: uid);
    });

class SportPreferencesNotifier extends StateNotifier<Map<String, String>> {
  SportPreferencesNotifier({this._uid}) : super(const {}) {
    _load();
  }

  final String? _uid;

  String get _key => _keyFor(_kSportPrefs, _uid);

  Future<void> _load() async {
    final storage = await LocalStorage.create();
    if (!mounted) return;
    final raw = storage.getString(_key);
    if (raw == null) return;
    try {
      final decoded = json.decode(raw) as Map<String, dynamic>;
      if (!mounted) return;
      state = decoded.map((k, v) => MapEntry(k, v as String));
    } catch (_) {
      // Corrupt data — start fresh.
      if (!mounted) return;
      await storage.remove(_key);
    }
  }

  Future<void> _persist() async {
    try {
      final storage = await LocalStorage.create();
      await storage.setString(_key, json.encode(state));
    } catch (e) {
      logError('SportPreferences persist failed', e);
    }
  }

  Future<void> setSport(String sport, String level) async {
    state = {...state, sport: level};
    await _persist();
  }

  Future<void> removeSport(String sport) async {
    final updated = Map<String, String>.from(state)..remove(sport);
    state = updated;
    await _persist();
  }

  Future<void> setAll(Map<String, String> prefs) async {
    state = Map.unmodifiable(prefs);
    await _persist();
  }

  Future<void> reset() async {
    state = const {};
    await _persist();
  }
}

// Distance filter.

/// Discovery distance in km — shared between preferences and filter screens.
final distanceFilterProvider = StateNotifierProvider<_DoubleNotifier, double>((
  ref,
) {
  final uid = ref.watch(authStateProvider.select((s) => s.userId));
  return _DoubleNotifier(_keyFor(_kDistance, uid), 5);
});

class _DoubleNotifier extends StateNotifier<double> {
  _DoubleNotifier(this._key, double defaultValue) : super(defaultValue) {
    _load(defaultValue);
  }

  final String _key;

  Future<void> _load(double fallback) async {
    final storage = await LocalStorage.create();
    if (!mounted) return;
    final v = storage.getDouble(_key);
    if (v != null) state = v;
  }

  void set(double value) {
    state = value;
    _persist(value);
  }

  Future<void> _persist(double value) async {
    try {
      final storage = await LocalStorage.create();
      await storage.setDouble(_key, value);
    } catch (e) {
      logError('DistanceFilter persist failed', e);
    }
  }
}

// Price filter.

/// Persisted to [SharedPreferences].
final priceFilterProvider = StateNotifierProvider<_StringNotifier, String>((
  ref,
) {
  final uid = ref.watch(authStateProvider.select((s) => s.userId));
  return _StringNotifier(_keyFor(_kPrice, uid), 'both');
});

class _StringNotifier extends StateNotifier<String> {
  _StringNotifier(this._key, String defaultValue) : super(defaultValue) {
    _load(defaultValue);
  }

  final String _key;

  Future<void> _load(String fallback) async {
    final storage = await LocalStorage.create();
    if (!mounted) return;
    final v = storage.getString(_key);
    if (v != null) state = v;
  }

  void set(String value) {
    state = value;
    _persist(value);
  }

  Future<void> _persist(String value) async {
    try {
      final storage = await LocalStorage.create();
      await storage.setString(_key, value);
    } catch (e) {
      logError('PriceFilter persist failed', e);
    }
  }
}
