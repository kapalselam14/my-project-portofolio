import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:matchup_mobile/core/widgets/app_button.dart';

Widget _wrap(Widget w) => MaterialApp(home: Scaffold(body: w));

void main() {
  group('AppButton', () {
    testWidgets('should render label text', (tester) async {
      await tester.pumpWidget(
        _wrap(AppButton(label: 'Submit', onPressed: () {})),
      );
      expect(find.text('Submit'), findsOneWidget);
    });

    testWidgets('should call onPressed when tapped', (tester) async {
      var pressed = false;
      await tester.pumpWidget(
        _wrap(AppButton(label: 'Go', onPressed: () => pressed = true)),
      );
      await tester.tap(find.text('Go'));
      expect(pressed, isTrue);
    });

    testWidgets('should not call onPressed when disabled (onPressed null)', (
      tester,
    ) async {
      var pressed = false;
      await tester.pumpWidget(
        _wrap(AppButton(label: 'Disabled', onPressed: null)),
      );
      await tester.tap(find.text('Disabled'), warnIfMissed: false);
      expect(pressed, isFalse);
    });

    testWidgets('should show loading indicator when loading is true', (
      tester,
    ) async {
      await tester.pumpWidget(
        _wrap(AppButton(label: 'Save', onPressed: () {}, loading: true)),
      );
      expect(find.byType(CircularProgressIndicator), findsOneWidget);
      expect(find.text('Save'), findsNothing);
    });

    testWidgets('should use secondary variant without crashing', (
      tester,
    ) async {
      await tester.pumpWidget(
        _wrap(AppButton.secondary(label: 'Cancel', onPressed: () {})),
      );
      expect(find.text('Cancel'), findsOneWidget);
    });

    testWidgets('should use ghost variant without crashing', (tester) async {
      await tester.pumpWidget(
        _wrap(AppButton.ghost(label: 'Skip', onPressed: () {})),
      );
      expect(find.text('Skip'), findsOneWidget);
    });

    testWidgets('should use danger variant without crashing', (tester) async {
      await tester.pumpWidget(
        _wrap(AppButton.danger(label: 'Delete', onPressed: () {})),
      );
      expect(find.text('Delete'), findsOneWidget);
    });
  });
}
