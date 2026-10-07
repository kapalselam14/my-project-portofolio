import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:matchup_mobile/core/widgets/app_text_field.dart';

Widget _wrap(Widget w) => MaterialApp(home: Scaffold(body: w));

/// Regression coverage for PRD Appendix B.4: the app's global
/// `InputDecorationTheme` sets a visible focused underline for any
/// `TextField`/`TextFormField` that doesn't explicitly override
/// `focusedBorder`. Both [AppTextField] variants must set every border
/// state explicitly so no stray underline leaks through.
void _expectNoUnderlineBorder(WidgetTester tester) {
  final decoratedBoxes = tester.widgetList<InputDecorator>(
    find.byType(InputDecorator),
  );
  for (final box in decoratedBoxes) {
    expect(
      box.decoration.border,
      isNot(isA<UnderlineInputBorder>()),
      reason: 'AppTextField must never fall back to the default underline',
    );
  }
}

void main() {
  group('AppTextField.pill', () {
    testWidgets('should render hint text', (tester) async {
      await tester.pumpWidget(
        _wrap(const AppTextField.pill(hint: 'Search chats, sports…')),
      );
      expect(find.text('Search chats, sports…'), findsOneWidget);
    });

    testWidgets('should call onChanged when text is entered', (tester) async {
      String? value;
      await tester.pumpWidget(
        _wrap(AppTextField.pill(hint: 'Search', onChanged: (v) => value = v)),
      );
      await tester.enterText(find.byType(TextField), 'basketball');
      expect(value, 'basketball');
    });

    testWidgets('should render a leading widget', (tester) async {
      await tester.pumpWidget(
        _wrap(
          const AppTextField.pill(hint: 'Search', leading: Icon(Icons.search)),
        ),
      );
      expect(find.byIcon(Icons.search), findsOneWidget);
    });

    testWidgets('should not leak the default Material underline', (
      tester,
    ) async {
      await tester.pumpWidget(_wrap(const AppTextField.pill(hint: 'Search')));
      await tester.tap(find.byType(TextField));
      await tester.pump();
      _expectNoUnderlineBorder(tester);
    });
  });

  group('AppTextField.form', () {
    testWidgets('should render its label above the field', (tester) async {
      await tester.pumpWidget(
        _wrap(const AppTextField.form(label: 'FULL NAME')),
      );
      expect(find.text('FULL NAME'), findsOneWidget);
    });

    testWidgets('should show errorText when provided', (tester) async {
      await tester.pumpWidget(
        _wrap(
          const AppTextField.form(
            label: 'EMAIL',
            errorText: 'Invalid email format',
          ),
        ),
      );
      expect(find.text('Invalid email format'), findsOneWidget);
    });

    testWidgets('should call onChanged when text is entered', (tester) async {
      String? value;
      await tester.pumpWidget(
        _wrap(AppTextField.form(label: 'BIO', onChanged: (v) => value = v)),
      );
      await tester.enterText(find.byType(TextFormField), 'Loves basketball');
      expect(value, 'Loves basketball');
    });

    testWidgets('should not leak the default Material underline', (
      tester,
    ) async {
      await tester.pumpWidget(_wrap(const AppTextField.form(label: 'PHONE')));
      await tester.tap(find.byType(TextFormField));
      await tester.pump();
      _expectNoUnderlineBorder(tester);
    });
  });
}
