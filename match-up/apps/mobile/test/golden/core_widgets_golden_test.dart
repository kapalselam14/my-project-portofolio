// Golden tests for core/widgets primitives — PRD Phase 5 task: lock in the
// visual shape of the shared building blocks (AppScaffold's 3 header
// variants, AppCard, AppTextField's 2 variants, AppTabBar, EmptyState,
// ActivityCardSkeleton) so a future change to any of them that shifts
// layout, spacing, or colour is caught here first instead of surfacing as
// an unnoticed regression across the ~32 screens that compose them.
//
// Uses Flutter's built-in `matchesGoldenFile` (no golden_toolkit or other
// third-party golden package — this project has no prior golden-test
// infrastructure, so this intentionally reaches for what's already
// bundled with flutter_test rather than adding a new dependency for one
// test file).
//
// Regenerate goldens after an intentional visual change:
//   flutter test --update-goldens test/golden/core_widgets_golden_test.dart
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:matchup_mobile/core/theme/dark_colors.dart';
import 'package:matchup_mobile/core/widgets/app_card.dart';
import 'package:matchup_mobile/core/widgets/app_scaffold.dart';
import 'package:matchup_mobile/core/widgets/app_tab_bar.dart';
import 'package:matchup_mobile/core/widgets/app_text_field.dart';
import 'package:matchup_mobile/core/widgets/empty_state.dart';
import 'package:matchup_mobile/core/widgets/skeleton.dart';

/// Loads every font family declared in pubspec.yaml into the test engine
/// (mirrors what golden_toolkit's `loadAppFonts` does, using only
/// flutter-bundled APIs). Without this, text falls back to OS system fonts
/// (Helvetica on macOS, DejaVu Sans on Linux), which made these goldens
/// pass locally but fail on CI. Loading the real TTF bytes removes that
/// gross difference; the subpixel remainder is absorbed by
/// [_TolerantGoldenComparator] below.
Future<void> _loadAppFonts() async {
  final manifest =
      jsonDecode(await rootBundle.loadString('FontManifest.json'))
          as List<dynamic>;
  for (final family in manifest) {
    final loader = FontLoader((family as Map)['family'] as String);
    for (final font in (family['fonts'] as List<dynamic>)) {
      loader.addFont(rootBundle.load((font as Map)['asset'] as String));
    }
    await loader.load();
  }
}

/// Fixed light [ThemeData] registering [AppColorTokens.light] — goldens
/// must render against a stable, explicit theme rather than whatever a
/// bare `MaterialApp()` defaults to, so a theme change elsewhere can't
/// silently shift every golden at once without a deliberate re-record.
ThemeData _goldenTheme() {
  return ThemeData(
    useMaterial3: true,
    brightness: Brightness.light,
    // Body-tier family, loaded by [_loadAppFonts] — a named-but-unloaded
    // family would fall back to OS system fonts and break cross-platform
    // determinism (see above).
    fontFamily: 'Geist',
    extensions: const [AppColorTokens.light],
  );
}

Widget _wrap(Widget child) {
  return MaterialApp(
    theme: _goldenTheme(),
    debugShowCheckedModeBanner: false,
    home: Scaffold(body: child),
  );
}

Future<void> _expectGolden(
  WidgetTester tester,
  Widget widget,
  String goldenName, {
  Size size = const Size(390, 844),
}) async {
  await tester.binding.setSurfaceSize(size);
  addTearDown(() => tester.binding.setSurfaceSize(null));
  await tester.pumpWidget(_wrap(widget));
  await tester.pumpAndSettle();
  await expectLater(
    find.byType(MaterialApp),
    matchesGoldenFile('goldens/$goldenName.png'),
  );
}

/// [LocalFileComparator] with a small allowable pixel-difference budget.
///
/// Even with identical font bytes and Flutter version, glyph rasterization
/// differs slightly between macOS and Linux (fontconfig hinting/AA — see
/// the "Including Fonts" section of [matchesGoldenFile]'s docs), so an
/// exact pixel match can never hold across both. A 2% budget absorbs that
/// noise while still catching genuine regressions: a layout/colour change
/// in one of these small widgets moves far more than 2% of pixels.
class _TolerantGoldenComparator extends LocalFileComparator {
  _TolerantGoldenComparator(super.testFile, {this.precisionTolerance = 0.02})
    : assert(
        0 <= precisionTolerance && precisionTolerance <= 1,
        'precisionTolerance must be between 0 and 1',
      );

  final double precisionTolerance;

  @override
  Future<bool> compare(Uint8List imageBytes, Uri golden) async {
    final ComparisonResult result = await GoldenFileComparator.compareLists(
      imageBytes,
      await getGoldenBytes(golden),
    );
    final bool passed =
        result.passed || result.diffPercent <= precisionTolerance;
    if (passed) {
      result.dispose();
      return true;
    }
    final String error = await generateFailureOutput(result, golden, basedir);
    result.dispose();
    throw FlutterError(error);
  }
}

void main() {
  setUpAll(() async {
    TestWidgetsFlutterBinding.ensureInitialized();
    await _loadAppFonts();
    // Reuse the basedir of the bootstrap-installed comparator (it points
    // at this test file's directory). NOTE: do not build the replacement
    // from `Platform.script` — under `flutter test` that is the generated
    // bootstrap file, not this test file, so goldens would resolve nowhere.
    // Appending a dummy filename recovers an equivalent testFile URI
    // because the basedir is derived via `dirname(testFile)`.
    final GoldenFileComparator current = goldenFileComparator;
    if (current is LocalFileComparator) {
      goldenFileComparator = _TolerantGoldenComparator(
        current.basedir.resolve('core_widgets_golden_test.dart'),
      );
    }
  });

  group('AppScaffold goldens', () {
    testWidgets('primary variant', (tester) async {
      await _expectGolden(
        tester,
        AppScaffold.primary(
          title: 'My Activities',
          actions: const [Icon(Icons.notifications_none, size: 24)],
          body: const Center(child: Text('Body content')),
        ),
        'app_scaffold_primary',
      );
    });

    testWidgets('detail variant', (tester) async {
      await _expectGolden(
        tester,
        AppScaffold.detail(
          title: 'Manage Activity',
          body: const Center(child: Text('Body content')),
        ),
        'app_scaffold_detail',
      );
    });

    testWidgets('sheet variant', (tester) async {
      await _expectGolden(
        tester,
        AppScaffold.sheet(
          title: 'Edit Profile',
          trailingAction: 'Save',
          onTrailingAction: () {},
          body: const Center(child: Text('Body content')),
        ),
        'app_scaffold_sheet',
      );
    });
  });

  group('AppCard golden', () {
    testWidgets('default', (tester) async {
      await _expectGolden(
        tester,
        const Center(
          child: Padding(
            padding: EdgeInsets.all(24),
            child: AppCard(
              child: SizedBox(
                width: 300,
                height: 120,
                child: Center(child: Text('Card content')),
              ),
            ),
          ),
        ),
        'app_card_default',
        size: const Size(390, 300),
      );
    });
  });

  group('AppTextField goldens', () {
    testWidgets('pill variant', (tester) async {
      await _expectGolden(
        tester,
        const Padding(
          padding: EdgeInsets.all(24),
          child: AppTextField.pill(
            hint: 'Search chats, sports or matches...',
            leading: Icon(Icons.search, size: 20),
          ),
        ),
        'app_text_field_pill',
        size: const Size(390, 220),
      );
    });

    testWidgets('form variant', (tester) async {
      await _expectGolden(
        tester,
        const Padding(
          padding: EdgeInsets.all(24),
          child: AppTextField.form(label: 'FULL NAME', hint: 'Jane Doe'),
        ),
        'app_text_field_form',
        size: const Size(390, 220),
      );
    });
  });

  group('AppTabBar golden', () {
    testWidgets('default', (tester) async {
      await _expectGolden(
        tester,
        Padding(
          padding: const EdgeInsets.all(24),
          child: AppTabBar(
            labels: const ['Upcoming', 'Past', 'Hosting'],
            selectedIndex: 0,
            onChanged: (_) {},
          ),
        ),
        'app_tab_bar_default',
        size: const Size(390, 100),
      );
    });
  });

  group('EmptyState golden', () {
    testWidgets('with action', (tester) async {
      await _expectGolden(
        tester,
        EmptyState(
          icon: Icons.calendar_today_outlined,
          title: 'No upcoming activities',
          subtitle: 'Discover activities near you and join one!',
          actionLabel: 'Discover',
          onAction: () {},
        ),
        'empty_state_with_action',
      );
    });
  });

  group('ActivityCardSkeleton golden', () {
    testWidgets('default', (tester) async {
      // Shimmer is animated (AppDurations.shimmer, repeating) — pump a
      // single frame at t=0 rather than pumpAndSettle (which would never
      // settle on a repeating animation) so the golden captures a
      // deterministic frame of the sweep.
      await tester.binding.setSurfaceSize(const Size(390, 500));
      addTearDown(() => tester.binding.setSurfaceSize(null));
      await tester.pumpWidget(
        _wrap(
          const Padding(
            padding: EdgeInsets.all(16),
            child: ActivityCardSkeleton(),
          ),
        ),
      );
      await tester.pump();
      await expectLater(
        find.byType(MaterialApp),
        matchesGoldenFile('goldens/activity_card_skeleton.png'),
      );
    });
  });
}
