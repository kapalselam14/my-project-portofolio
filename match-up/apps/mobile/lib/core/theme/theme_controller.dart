// theme controller (theme).
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../storage/local_storage.dart';

const _kThemeModeKey = 'theme_mode';

final themeModeProvider = StateNotifierProvider<ThemeModeController, ThemeMode>(
  (ref) => ThemeModeController(),
);

class ThemeModeController extends StateNotifier<ThemeMode> {
  ThemeModeController() : super(ThemeMode.system) {
    _load();
  }

  Future<void> _load() async {
    final storage = await LocalStorage.create();
    final value = storage.getString(_kThemeModeKey);
    if (value != null) {
      state = ThemeMode.values.firstWhere(
        (m) => m.name == value,
        orElse: () => ThemeMode.system,
      );
    }
  }

  Future<void> set(ThemeMode mode) async {
    state = mode;
    final storage = await LocalStorage.create();
    await storage.setString(_kThemeModeKey, mode.name);
  }
}
