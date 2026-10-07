import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/prefs_tour_store.dart';
import '../data/tour_store.dart';
import '../domain/tour_state.dart';
import '../domain/tour_step.dart';

final tourStoreProvider = Provider<TourStore>((ref) => PrefsTourStore());

/// True once Discovery's feed has finished loading (skeleton gone, real deck / empty state on screen).
final discoveryContentReadyProvider = StateProvider<bool>((ref) => false);

final tourControllerProvider = StateNotifierProvider<TourController, TourState>(
  (ref) => TourController(ref.watch(tourStoreProvider)),
);

/// Drives a coach-mark tour: which step is showing, advancing/going back, and persisting completion so a given tour.
/// This class is deliberately widget-free (no `BuildContext`, no `OverlayEntry`) so it can be unit tested without.
class TourController extends StateNotifier<TourState> {
  TourController(this._store) : super(const TourState.idle());

  final TourStore _store;

  /// Tracks the tour id currently armed/active so [complete] knows which flag to persist.
  String? _activeTourId;

  /// Guards [maybeStart] against concurrent invocations racing the async `hasSeen` check.
  bool _starting = false;

  /// Titles of steps auto-skipped because their anchor wasn't mounted (see `TourHost`).
  final List<String> _skippedTitles = [];

  /// Set by get-to-know-3 after a successful first onboarding: the tour must start on the NEXT Discovery visit.
  bool _firstRunPending = false;

  /// Arms the first-run tour for the next Discovery visit. Idempotent.
  void armFirstRun() {
    _firstRunPending = true;
  }

  /// Consumes the first-run arm flag. Returns true exactly once per arm.
  bool consumeFirstRunArm() {
    if (!_firstRunPending) return false;
    _firstRunPending = false;
    return true;
  }

  /// Read-only view of auto-skipped step titles for the current tour.
  List<String> get skippedTitles => List.unmodifiable(_skippedTitles);

  /// Starts [tourId] only if it hasn't been seen before.
  Future<void> maybeStart(String tourId, List<TourStep> steps) async {
    if (state.isActive || _starting) return;
    _starting = true;
    try {
      final seen = await _store.hasSeen(tourId);
      if (seen) return;
      // Re-check: a concurrent caller.
      if (state.isActive) return;
      start(tourId, steps);
    } finally {
      _starting = false;
    }
  }

  /// Starts [tourId] regardless of whether it has been seen before — used by the "Replay tour" entry point.
  void start(String tourId, List<TourStep> steps) {
    if (steps.isEmpty) return;
    _activeTourId = tourId;
    _skippedTitles.clear();
    state = TourState(steps: steps, index: 0, isActive: true);
  }

  void next() {
    if (!state.isActive) return;
    if (state.isLast) {
      complete();
      return;
    }
    state = state.copyWith(index: state.index + 1);
  }

  /// Advances past the current step because its anchor isn't on screen.
  void skipUnavailableStep() {
    if (!state.isActive) return;
    final step = state.current;
    if (step != null) {
      _skippedTitles.add(step.title);
      debugPrint('[Tour] skipping unavailable anchor: ${step.title}');
    }
    next();
  }

  void back() {
    if (!state.isActive || state.index == 0) return;
    state = state.copyWith(index: state.index - 1);
  }

  /// Skipping has the same effect as completing.
  Future<bool> skip() => complete();

  /// Persists the seen flag BEFORE going idle.
  Future<bool> complete() async {
    final tourId = _activeTourId;
    if (tourId != null) {
      try {
        await _store.markSeen(tourId);
      } catch (_) {
        return false;
      }
    }
    state = const TourState.idle();
    _activeTourId = null;
    return true;
  }
}
