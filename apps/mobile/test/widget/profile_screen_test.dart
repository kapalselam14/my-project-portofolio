import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:mocktail/mocktail.dart';

import 'package:matchup_mobile/core/providers/repository_providers.dart';
import 'package:matchup_mobile/core/theme/theme_controller.dart';
import 'package:matchup_mobile/features/profile/data/user_repository.dart';
import 'package:matchup_mobile/features/profile/domain/user_model.dart';
import 'package:matchup_mobile/features/profile/presentation/profile_screen.dart';

class _MockUserRepository extends Mock implements UserRepository {}

void main() {
  late _MockUserRepository userRepo;

  setUp(() {
    userRepo = _MockUserRepository();
    when(() => userRepo.me()).thenAnswer(
      (_) async => const UserModel(
        id: 'me',
        displayName: 'Alex Mercer',
        rating: 4.9,
        activitiesCount: 27,
        hostedCount: 11,
        sports: [
          (sport: 'Basketball', level: 'Intermediate'),
          (sport: 'Running', level: 'Beginner'),
        ],
      ),
    );
  });

  Future<void> pumpScreen(WidgetTester tester) async {
    final router = GoRouter(
      initialLocation: '/profile',
      routes: [
        GoRoute(path: '/profile', builder: (_, _) => const ProfileScreen()),
        GoRoute(
          path: '/edit-profile',
          builder: (_, _) => const Scaffold(body: Text('Edit Profile Screen')),
        ),
        GoRoute(
          path: '/notifications',
          builder: (_, _) => const Scaffold(body: Text('Notifications')),
        ),
        GoRoute(
          path: '/calendar',
          builder: (_, _) => const Scaffold(body: Text('Calendar')),
        ),
      ],
    );

    await tester.pumpWidget(
      ProviderScope(
        overrides: [userRepositoryProvider.overrideWithValue(userRepo)],
        child: MaterialApp.router(routerConfig: router),
      ),
    );
    await tester.pumpAndSettle();
  }

  group('ProfileScreen', () {
    testWidgets(
      'should render real stats from the repository, not hardcoded values',
      (tester) async {
        await pumpScreen(tester);
        // Waits for the 900ms count-up animation to finish rendering '27'/'11'.
        await tester.pump(const Duration(milliseconds: 950));

        expect(find.text('27'), findsOneWidget);
        expect(find.text('11'), findsOneWidget);
        expect(find.text('4.9'), findsOneWidget);
      },
    );

    testWidgets('should render sports from user.sports, not a hardcoded list', (
      tester,
    ) async {
      await pumpScreen(tester);
      expect(find.textContaining('Basketball'), findsOneWidget);
      expect(find.textContaining('Running'), findsOneWidget);
      // The old hardcoded list included Tennis — must not appear.
      expect(find.textContaining('Tennis'), findsNothing);
    });

    testWidgets('should push edit-profile when the option row is tapped', (
      tester,
    ) async {
      await pumpScreen(tester);
      await tester.tap(find.text('Edit Profile'));
      await tester.pumpAndSettle();
      expect(find.text('Edit Profile Screen'), findsOneWidget);
    });

    // Regression test for the dark-mode migration (PRD Phase 5): the
    // Appearance row's Light/Dark/System picker must keep updating
    // themeModeProvider after AppColors.* -> context.colors.* migration.
    testWidgets(
      'should update themeModeProvider when Dark is picked from Appearance',
      (tester) async {
        final container = ProviderContainer(
          overrides: [userRepositoryProvider.overrideWithValue(userRepo)],
        );
        addTearDown(container.dispose);

        final router = GoRouter(
          initialLocation: '/profile',
          routes: [
            GoRoute(path: '/profile', builder: (_, _) => const ProfileScreen()),
          ],
        );

        await tester.pumpWidget(
          UncontrolledProviderScope(
            container: container,
            child: MaterialApp.router(routerConfig: router),
          ),
        );
        await tester.pumpAndSettle();

        expect(find.text('Appearance'), findsOneWidget);
        expect(find.text('System'), findsOneWidget);

        // Open the bottom sheet via the row's Semantics node — tapping
        // the raw 'System' text is flaky (small hit target, and the label
        // text is duplicated once the sheet opens).
        final appearanceRow = find.byWidgetPredicate(
          (w) => w is Semantics && w.properties.label == 'Appearance: System',
        );
        // The Appearance row sits below the fold — scroll it into view
        // first, otherwise the tap misses (row is off-screen at 800x600).
        await tester.ensureVisible(appearanceRow);
        await tester.pumpAndSettle();
        await tester.tap(appearanceRow);
        await tester.pumpAndSettle();

        expect(find.text('Dark'), findsOneWidget);
        final darkOption = find.byWidgetPredicate(
          (w) => w is Semantics && w.properties.label == 'Dark',
        );
        expect(darkOption, findsOneWidget);
        await tester.tap(darkOption);
        await tester.pumpAndSettle();

        expect(container.read(themeModeProvider), ThemeMode.dark);
        expect(find.text('Dark'), findsOneWidget);
      },
    );
  });
}
