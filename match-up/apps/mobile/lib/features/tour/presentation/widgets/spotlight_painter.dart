import 'package:flutter/material.dart';

import '../../domain/tour_step.dart';

/// Paints a full-screen scrim with a cut-out ("hole") around [holeRect].
/// The hole is drawn with a proper alpha-clear via `Path.combine` + `BlendMode.clear` on a saved layer.
class SpotlightPainter extends CustomPainter {
  const SpotlightPainter({
    required this.holeRect,
    required this.shape,
    required this.holeRadius,
    required this.scrimColor,
  });

  /// `null` renders a plain full-screen scrim with no cut-out (the "welcome" step, which has no anchor).
  final Rect? holeRect;
  final TourSpotlightShape shape;
  final double holeRadius;
  final Color scrimColor;

  @override
  void paint(Canvas canvas, Size size) {
    final screenRect = Rect.fromLTWH(0, 0, size.width, size.height);

    if (holeRect == null) {
      canvas.drawRect(screenRect, Paint()..color = scrimColor);
      return;
    }

    final scrimPath = Path()..addRect(screenRect);
    final holePath = shape == TourSpotlightShape.circle
        ? (Path()..addOval(holeRect!))
        : (Path()..addRRect(
            RRect.fromRectAndRadius(holeRect!, Radius.circular(holeRadius)),
          ));

    final cutPath = Path.combine(PathOperation.difference, scrimPath, holePath);

    canvas.drawPath(cutPath, Paint()..color = scrimColor);
  }

  @override
  bool shouldRepaint(SpotlightPainter oldDelegate) {
    return oldDelegate.holeRect != holeRect ||
        oldDelegate.shape != shape ||
        oldDelegate.holeRadius != holeRadius ||
        oldDelegate.scrimColor != scrimColor;
  }
}
