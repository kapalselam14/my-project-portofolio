import 'tour_step.dart';

/// Immutable state for an in-progress (or idle) coach-mark tour.
class TourState {
  const TourState({
    required this.steps,
    required this.index,
    required this.isActive,
  });

  const TourState.idle() : steps = const [], index = 0, isActive = false;

  final List<TourStep> steps;
  final int index;
  final bool isActive;

  /// The step currently on screen, or `null` when idle or out of bounds.
  TourStep? get current =>
      isActive && index >= 0 && index < steps.length ? steps[index] : null;

  bool get isLast => steps.isEmpty || index >= steps.length - 1;

  /// Fraction complete, e.g. step 2 of 6 → 2/6. Used for the "2/6" label.
  double get progress => steps.isEmpty ? 0 : (index + 1) / steps.length;

  TourState copyWith({List<TourStep>? steps, int? index, bool? isActive}) {
    return TourState(
      steps: steps ?? this.steps,
      index: index ?? this.index,
      isActive: isActive ?? this.isActive,
    );
  }
}
