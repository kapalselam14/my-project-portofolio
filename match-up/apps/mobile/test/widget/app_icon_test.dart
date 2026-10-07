import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:matchup_mobile/core/widgets/app_icon.dart';

Widget _wrap(Widget w) => MaterialApp(home: Scaffold(body: w));

void main() {
  group('AppIcon', () {
    testWidgets('should render an SvgPicture for a catalogue asset', (
      tester,
    ) async {
      await tester.pumpWidget(_wrap(const AppIcon(AppIcons.clock)));
      expect(find.byType(SvgPicture), findsOneWidget);
    });

    testWidgets('should size the icon according to AppIconSize', (
      tester,
    ) async {
      await tester.pumpWidget(
        _wrap(const AppIcon(AppIcons.star, size: AppIconSize.xl)),
      );
      final svg = tester.widget<SvgPicture>(find.byType(SvgPicture));
      expect(svg.width, 24);
      expect(svg.height, 24);
    });

    testWidgets('.material should render a Material Icon instead of svg', (
      tester,
    ) async {
      await tester.pumpWidget(
        _wrap(const AppIcon.material(Icons.qr_code_scanner_rounded)),
      );
      expect(find.byIcon(Icons.qr_code_scanner_rounded), findsOneWidget);
      expect(find.byType(SvgPicture), findsNothing);
    });
  });
}
