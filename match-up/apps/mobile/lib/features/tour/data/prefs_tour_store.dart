import 'package:shared_preferences/shared_preferences.dart';

import 'tour_store.dart';

/// [TourStore] backed directly by `shared_preferences`, mirroring the pattern used by `ThemeModeController`.
class PrefsTourStore implements TourStore {
  static const _keyPrefix = 'tour_seen_v1_';

  String _key(String tourId) => '$_keyPrefix$tourId';

  @override
  Future<bool> hasSeen(String tourId) async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getBool(_key(tourId)) ?? false;
  }

  @override
  Future<void> markSeen(String tourId) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_key(tourId), true);
  }

  @override
  Future<void> reset(String tourId) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_key(tourId));
  }
}
