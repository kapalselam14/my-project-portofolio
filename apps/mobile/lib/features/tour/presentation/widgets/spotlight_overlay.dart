import 'package:flutter/material.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../domain/tour_step.dart';
import 'spotlight_painter.dart';

/// Full-screen spotlight: a dimmed scrim with a cut-out around.
/// Pure widget — no `OverlayEntry`, no `Ref`, no persistence.
class SpotlightOverlay extends StatelessWidget {
  const SpotlightOverlay({
    super.key,
    required this.holeRect,
    required this.shape,
    required this.holeRadius,
    required this.child,
    required this.onTapScrim,
    this.scrimColor,
  });

  /// `null` → no cut-out, scrim only, callout centered on screen (the "welcome" step).
  final Rect? holeRect;
  final TourSpotlightShape shape;
  final double holeRadius;

  /// The callout card.
  final Widget child;

  /// Invoked when the user taps the dimmed scrim area OUTSIDE the hole and the callout.
  final VoidCallback onTapScrim;

  /// Overrides the scrim fill.
  final Color? scrimColor;

  static const double _gap = AppSpacing.x3;
  static const double _edgeInset = AppSpacing.x4;

  @override
  Widget build(BuildContext context) {
    final size = MediaQuery.of(context).size;
    final safePadding = MediaQuery.of(context).padding;

    return Stack(
      children: [
        // Scrim + cut-out. No additional AbsorbPointer is needed on top of this.
        Positioned.fill(
          child: GestureDetector(
            behavior: HitTestBehavior.opaque,
            onTap: onTapScrim,
            child: CustomPaint(
              painter: SpotlightPainter(
                holeRect: holeRect,
                shape: shape,
                holeRadius: holeRadius,
                scrimColor: scrimColor ?? AppColors.scrimIllustration,
              ),
            ),
          ),
        ),

        // No-op absorber over the spotlighted control: taps inside the hole land here.
        if (holeRect != null)
          Positioned.fromRect(
            rect: holeRect!,
            child: GestureDetector(
              behavior: HitTestBehavior.opaque,
              onTap: () {},
              child: const ColoredBox(color: Colors.transparent),
            ),
          ),

        // Callout, positioned relative to the hole (or centered if none).
        if (holeRect == null)
          Center(child: child)
        else
          _PositionedCallout(
            holeRect: holeRect!,
            screenSize: size,
            safePadding: safePadding,
            gap: _gap,
            edgeInset: _edgeInset,
            child: child,
          ),
      ],
    );
  }
}

/// Lays the callout out below the hole if there's room, above it otherwise, and clamps horizontally so it never runs.
class _PositionedCallout extends StatelessWidget {
  const _PositionedCallout({
    required this.holeRect,
    required this.screenSize,
    required this.safePadding,
    required this.gap,
    required this.edgeInset,
    required this.child,
  });

  final Rect holeRect;
  final Size screenSize;
  final EdgeInsets safePadding;
  final double gap;
  final double edgeInset;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final maxCalloutWidth = screenSize.width - edgeInset * 2;
    final spaceBelow = screenSize.height - safePadding.bottom - holeRect.bottom;
    final spaceAbove = holeRect.top - safePadding.top;

    // Prefer below; flip above only if below genuinely doesn't fit.
    final placeBelow = spaceBelow >= 160 || spaceBelow >= spaceAbove;

    return Positioned(
      left: edgeInset,
      right: edgeInset,
      top: placeBelow ? holeRect.bottom + gap : null,
      bottom: placeBelow ? null : screenSize.height - holeRect.top + gap,
      child: Align(
        alignment: Alignment.centerLeft,
        child: ConstrainedBox(
          constraints: BoxConstraints(maxWidth: maxCalloutWidth),
          child: child,
        ),
      ),
    );
  }
}
