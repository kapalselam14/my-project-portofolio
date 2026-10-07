import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:matchup_mobile/core/widgets/app_tappable.dart';

Widget _wrap(Widget w) => MaterialApp(
  home: Scaffold(body: Center(child: w)),
);

void main() {
  group('AppTappable', () {
    testWidgets('should enforce a minimum 44x44 hit area', (tester) async {
      await tester.pumpWidget(
        _wrap(
          AppTappable(
            semanticLabel: 'Tiny icon',
            onTap: () {},
            // Visual child is deliberately much smaller than the hit area.
            child: const SizedBox(width: 12, height: 12),
          ),
        ),
      );
      final size = tester.getSize(find.byType(AppTappable));
      expect(size.width, greaterThanOrEqualTo(44));
      expect(size.height, greaterThanOrEqualTo(44));
    });

    testWidgets('should not shrink the hit area below minSize even with a '
        'larger child', (tester) async {
      await tester.pumpWidget(
        _wrap(
          AppTappable(
            semanticLabel: 'Big icon',
            onTap: () {},
            child: const SizedBox(width: 60, height: 60),
          ),
        ),
      );
      final size = tester.getSize(find.byType(AppTappable));
      expect(size.width, greaterThanOrEqualTo(60));
      expect(size.height, greaterThanOrEqualTo(60));
    });

    testWidgets('ripple feedback should call onTap when tapped', (
      tester,
    ) async {
      var tapped = false;
      await tester.pumpWidget(
        _wrap(
          AppTappable(
            semanticLabel: 'Ripple button',
            feedback: AppTapFeedback.ripple,
            onTap: () => tapped = true,
            child: const Icon(Icons.favorite),
          ),
        ),
      );
      await tester.tap(find.byType(AppTappable));
      expect(tapped, isTrue);
    });

    testWidgets('scale feedback should call onTap when tapped', (tester) async {
      var tapped = false;
      await tester.pumpWidget(
        _wrap(
          AppTappable(
            semanticLabel: 'Scale button',
            feedback: AppTapFeedback.scale,
            onTap: () => tapped = true,
            child: const Icon(Icons.favorite),
          ),
        ),
      );
      await tester.tap(find.byType(AppTappable));
      expect(tapped, isTrue);
    });

    testWidgets('scale feedback should shrink while pressed', (tester) async {
      await tester.pumpWidget(
        _wrap(
          AppTappable(
            semanticLabel: 'Press me',
            feedback: AppTapFeedback.scale,
            onTap: () {},
            child: const Icon(Icons.favorite),
          ),
        ),
      );
      final gesture = await tester.startGesture(
        tester.getCenter(find.byType(AppTappable)),
      );
      await tester.pump();
      final scaleWidget = tester.widget<AnimatedScale>(
        find.byType(AnimatedScale),
      );
      expect(scaleWidget.scale, lessThan(1.0));
      await gesture.up();
    });

    testWidgets('should not call onTap when disabled', (tester) async {
      var tapped = false;
      await tester.pumpWidget(
        _wrap(
          AppTappable(
            semanticLabel: 'Disabled button',
            enabled: false,
            onTap: () => tapped = true,
            child: const Icon(Icons.favorite),
          ),
        ),
      );
      await tester.tap(find.byType(AppTappable), warnIfMissed: false);
      expect(tapped, isFalse);
    });

    testWidgets('should carry the given semantic label', (tester) async {
      await tester.pumpWidget(
        _wrap(
          AppTappable(
            semanticLabel: 'Add to favorites',
            onTap: () {},
            child: const Icon(Icons.favorite_border),
          ),
        ),
      );
      expect(find.bySemanticsLabel('Add to favorites'), findsOneWidget);
    });
  });
}
