import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:matchup_mobile/features/tour/domain/tour_step.dart';
import 'package:matchup_mobile/features/tour/presentation/widgets/spotlight_overlay.dart';

void main() {
  const screenSize = Size(390, 844);

  Future<void> pumpOverlay(
    WidgetTester tester, {
    Rect? holeRect,
    TourSpotlightShape shape = TourSpotlightShape.roundedRect,
    VoidCallback? onTapScrim,
    Widget? child,
  }) async {
    // `setSurfaceSize` alone doesn't change `MediaQuery.size` on this
    // Flutter version — the layout logic under test reads MediaQuery
    // directly, so the test view itself must be resized via `tester.view`.
    tester.view.physicalSize = screenSize;
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.reset);

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: SpotlightOverlay(
            holeRect: holeRect,
            shape: shape,
            holeRadius: 16,
            onTapScrim: onTapScrim ?? () {},
            child: child ?? const Text('Callout'),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
  }

  testWidgets('should render the callout centered when there is no hole rect', (
    tester,
  ) async {
    await pumpOverlay(tester, holeRect: null);

    final calloutFinder = find.text('Callout');
    expect(calloutFinder, findsOneWidget);

    // Centered means its horizontal midpoint sits at the screen's
    // horizontal midpoint.
    final calloutCenter = tester.getCenter(calloutFinder);
    expect(calloutCenter.dx, closeTo(screenSize.width / 2, 1));
  });

  testWidgets(
    'should position the callout below the hole when there is room below',
    (tester) async {
      // A hole near the top of the screen leaves plenty of room below it.
      const hole = Rect.fromLTWH(20, 100, 200, 80);

      await pumpOverlay(tester, holeRect: hole);

      final calloutTop = tester.getTopLeft(find.text('Callout')).dy;
      expect(calloutTop, greaterThan(hole.bottom));
    },
  );

  testWidgets(
    'should flip the callout above the hole when there is no room below',
    (tester) async {
      // A hole near the bottom of the screen leaves no room below it.
      final hole = Rect.fromLTWH(20, screenSize.height - 120, 200, 80);

      await pumpOverlay(tester, holeRect: hole);

      final calloutBottom = tester.getBottomLeft(find.text('Callout')).dy;
      expect(calloutBottom, lessThan(hole.top));
    },
  );

  testWidgets('should invoke onTapScrim when the dimmed area is tapped', (
    tester,
  ) async {
    var tapped = false;
    const hole = Rect.fromLTWH(20, 100, 200, 80);

    await pumpOverlay(tester, holeRect: hole, onTapScrim: () => tapped = true);

    // Tap somewhere clearly outside the hole and outside the callout.
    await tester.tapAt(const Offset(300, 700));
    await tester.pumpAndSettle();

    expect(tapped, isTrue);
  });

  testWidgets(
    'should keep the callout within the screen bounds for a hole near the edge',
    (tester) async {
      // Hole hugging the right edge — callout must still be clamped inside
      // the screen, not overflowing to the right.
      final hole = Rect.fromLTWH(screenSize.width - 60, 100, 40, 40);

      await pumpOverlay(tester, holeRect: hole);

      final calloutRect = tester.getRect(find.text('Callout'));
      expect(calloutRect.right, lessThanOrEqualTo(screenSize.width));
      expect(calloutRect.left, greaterThanOrEqualTo(0));
    },
  );
}
