import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:matchup_mobile/core/widgets/app_card.dart';

void main() {
  group('AppCard', () {
    testWidgets('should render child content', (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(body: AppCard(child: Text('Hello'))),
        ),
      );
      expect(find.text('Hello'), findsOneWidget);
    });

    testWidgets('should call onTap when tapped', (tester) async {
      var tapped = false;
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: AppCard(
              onTap: () => tapped = true,
              child: const Text('Tap me'),
            ),
          ),
        ),
      );
      await tester.tap(find.text('Tap me'));
      expect(tapped, isTrue);
    });

    testWidgets('should not crash when onTap is null', (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(body: AppCard(child: Text('No tap'))),
        ),
      );
      await tester.tap(find.text('No tap'));
      // No error thrown
    });
  });
}
