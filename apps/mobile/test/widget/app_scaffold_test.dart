import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:matchup_mobile/core/widgets/app_scaffold.dart';

Widget _wrap(Widget w) => MaterialApp(home: w);

void main() {
  group('AppScaffold.primary', () {
    testWidgets('should render title and body', (tester) async {
      await tester.pumpWidget(
        _wrap(
          AppScaffold.primary(
            title: 'My Activities',
            body: const Text('Body content'),
          ),
        ),
      );
      expect(find.text('My Activities'), findsOneWidget);
      expect(find.text('Body content'), findsOneWidget);
    });

    testWidgets('should render trailing actions', (tester) async {
      await tester.pumpWidget(
        _wrap(
          AppScaffold.primary(
            title: 'Discover',
            actions: const [Icon(Icons.notifications)],
            body: const SizedBox(),
          ),
        ),
      );
      expect(find.byIcon(Icons.notifications), findsOneWidget);
    });
  });

  group('AppScaffold.detail', () {
    testWidgets('should render a back button and centred title', (
      tester,
    ) async {
      await tester.pumpWidget(
        _wrap(
          AppScaffold.detail(title: 'Manage Activity', body: const SizedBox()),
        ),
      );
      expect(find.text('Manage Activity'), findsOneWidget);
      expect(find.bySemanticsLabel('Back'), findsOneWidget);
    });

    testWidgets('should call onBack when the back button is tapped', (
      tester,
    ) async {
      var backTapped = false;
      await tester.pumpWidget(
        _wrap(
          AppScaffold.detail(
            title: 'Detail',
            onBack: () => backTapped = true,
            body: const SizedBox(),
          ),
        ),
      );
      await tester.tap(find.bySemanticsLabel('Back'));
      expect(backTapped, isTrue);
    });
  });

  group('AppScaffold.sheet', () {
    testWidgets('should render title and a trailing text action', (
      tester,
    ) async {
      await tester.pumpWidget(
        _wrap(
          AppScaffold.sheet(
            title: 'Edit Profile',
            trailingAction: 'Save',
            onTrailingAction: () {},
            body: const SizedBox(),
          ),
        ),
      );
      expect(find.text('Edit Profile'), findsOneWidget);
      expect(find.text('Save'), findsOneWidget);
    });

    testWidgets('should call onTrailingAction when the action is tapped', (
      tester,
    ) async {
      var saved = false;
      await tester.pumpWidget(
        _wrap(
          AppScaffold.sheet(
            title: 'Create Activity',
            trailingAction: 'Save',
            onTrailingAction: () => saved = true,
            body: const SizedBox(),
          ),
        ),
      );
      await tester.tap(find.text('Save'));
      expect(saved, isTrue);
    });

    testWidgets(
      'should not call onTrailingAction when trailingActionEnabled is false',
      (tester) async {
        var saved = false;
        await tester.pumpWidget(
          _wrap(
            AppScaffold.sheet(
              title: 'Create Activity',
              trailingAction: 'Save',
              trailingActionEnabled: false,
              onTrailingAction: () => saved = true,
              body: const SizedBox(),
            ),
          ),
        );
        await tester.tap(find.text('Save'), warnIfMissed: false);
        expect(saved, isFalse);
      },
    );

    testWidgets('should render without a trailing action when none is given', (
      tester,
    ) async {
      await tester.pumpWidget(
        _wrap(AppScaffold.sheet(title: 'Report', body: const SizedBox())),
      );
      expect(find.text('Report'), findsOneWidget);
    });
  });
}
