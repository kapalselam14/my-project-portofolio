import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:matchup_mobile/core/widgets/app_tab_bar.dart';

void main() {
  group('AppTabBar', () {
    testWidgets('should render every label', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: AppTabBar(
              labels: const ['Upcoming', 'Past', 'Hosting'],
              selectedIndex: 0,
              onChanged: (_) {},
            ),
          ),
        ),
      );
      expect(find.text('Upcoming'), findsOneWidget);
      expect(find.text('Past'), findsOneWidget);
      expect(find.text('Hosting'), findsOneWidget);
    });

    testWidgets('should call onChanged with the tapped index', (tester) async {
      int? selected;
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: AppTabBar(
              labels: const ['Upcoming', 'Past', 'Hosting'],
              selectedIndex: 0,
              onChanged: (i) => selected = i,
            ),
          ),
        ),
      );
      await tester.tap(find.text('Past'));
      expect(selected, 1);
    });

    testWidgets('should mark the selected tab as selected in semantics', (
      tester,
    ) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: AppTabBar(
              labels: const ['Upcoming', 'Past'],
              selectedIndex: 1,
              onChanged: (_) {},
            ),
          ),
        ),
      );
      expect(
        tester.getSemantics(find.text('Past')),
        matchesSemantics(
          isSelected: true,
          isButton: true,
          hasSelectedState: true,
          hasTapAction: true,
        ),
      );
    });
  });
}
