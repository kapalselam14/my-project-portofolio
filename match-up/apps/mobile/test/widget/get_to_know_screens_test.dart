import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

import 'package:matchup_mobile/core/providers/repository_providers.dart';
import 'package:matchup_mobile/core/utils/nav_guard.dart';
import 'package:matchup_mobile/features/preferences/presentation/get_to_know_1_screen.dart';
import 'package:matchup_mobile/features/preferences/presentation/get_to_know_2_screen.dart';
import 'package:matchup_mobile/features/preferences/presentation/get_to_know_3_screen.dart';
import 'package:matchup_mobile/features/profile/data/user_repository.dart';
import 'package:matchup_mobile/features/profile/domain/user_model.dart';

/// Test double that records onboarding saves instead of hitting the backend.
class _FakeUserRepository implements UserRepository {
  List<({String sport, String level})>? lastSports;
  String? lastJoinReason;

  @override
  Future<UserModel> updateProfile({
    String? displayName,
    String? bio,
    String? location,
    String? email,
    String? phone,
    DateTime? dateOfBirth,
    int? heightCm,
    int? weightKg,
    String? goal,
    List<({String sport, String level})>? sports,
    String? joinReason,
  }) async {
    lastSports = sports;
    lastJoinReason = joinReason;
    return UserModel(id: 'me', displayName: 'Test User');
  }

  @override
  Future<UserModel> me() => throw UnimplementedError();

  @override
  Future<UserModel?> byId(String id) => throw UnimplementedError();

  @override
  Future<UserModel> uploadAvatar({required String localPath}) =>
      throw UnimplementedError();
}

void main() {
  late _FakeUserRepository userRepo;

  setUp(() {
    userRepo = _FakeUserRepository();
    NavGuard.resetForTest();
  });

  Future<void> pumpRouter(WidgetTester tester) async {
    await tester.binding.setSurfaceSize(const Size(390, 844));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    final router = GoRouter(
      initialLocation: '/get-to-know-1',
      routes: [
        GoRoute(
          path: '/get-to-know-1',
          builder: (_, _) => const GetToKnow1Screen(),
        ),
        GoRoute(
          path: '/get-to-know-2',
          builder: (_, _) => const GetToKnow2Screen(),
        ),
        GoRoute(
          path: '/get-to-know-3',
          builder: (_, _) => const GetToKnow3Screen(),
        ),
        GoRoute(
          path: '/discovery',
          builder: (_, _) => const Scaffold(body: Text('Discovery')),
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

  group('GetToKnow1Screen', () {
    testWidgets('should render the step indicator and options', (tester) async {
      await pumpRouter(tester);
      expect(find.text('1/3'), findsOneWidget);
      expect(find.text('Stay active with new sports'), findsOneWidget);
    });

    testWidgets('should push get-to-know-2 when Next is tapped', (
      tester,
    ) async {
      await pumpRouter(tester);
      // GTK1 requires an explicit choice (no pre-selected default).
      await tester.tap(find.text('Meet new sports partners'));
      await tester.pump();
      await tester.tap(find.text('Next'));
      await tester.pumpAndSettle();
      expect(find.text('2/3'), findsOneWidget);
      expect(find.text('Which sports do you play?'), findsOneWidget);
    });

    testWidgets('should persist the selected reason to the backend', (
      tester,
    ) async {
      await pumpRouter(tester);
      await tester.tap(find.text('Meet new sports partners'));
      await tester.pump();
      await tester.pumpAndSettle();
      await tester.tap(find.text('Next'));
      await tester.pumpAndSettle();
      expect(userRepo.lastJoinReason, 'Meet new sports partners');
      expect(find.text('2/3'), findsOneWidget);
    });
  });

  group('GetToKnow2Screen', () {
    testWidgets(
      'should offer "Skip for now" until a sport is selected, then switch to Next',
      (tester) async {
        await pumpRouter(tester);
        await tester.tap(find.text('Meet new sports partners'));
        await tester.pump();
        await tester.tap(find.text('Next'));
        await tester.pumpAndSettle();

        expect(find.text('Skip for now'), findsOneWidget);

        // Tapping a chip opens the skill-level sheet; the sport is only
        // added once a level is chosen.
        await tester.tap(find.text('Basketball'));
        await tester.pumpAndSettle();
        await tester.tap(find.text('Intermediate'));
        await tester.pumpAndSettle();

        expect(find.text('Next (1 selected)'), findsOneWidget);
      },
    );

    testWidgets(
      'should not add the sport when the skill-level sheet is dismissed',
      (tester) async {
        await pumpRouter(tester);
        await tester.tap(find.text('Meet new sports partners'));
        await tester.pump();
        await tester.tap(find.text('Next'));
        await tester.pumpAndSettle();

        await tester.tap(find.text('Basketball'));
        await tester.pumpAndSettle();

        // Dismiss the sheet without choosing a level.
        Navigator.of(tester.element(find.text('Beginner'))).pop();
        await tester.pumpAndSettle();

        expect(find.text('Skip for now'), findsOneWidget);
      },
    );

    testWidgets('should navigate to step 3 when the CTA is tapped', (
      tester,
    ) async {
      await pumpRouter(tester);
      await tester.tap(find.text('Meet new sports partners'));
      await tester.pump();
      await tester.tap(find.text('Next'));
      await tester.pumpAndSettle();

      await tester.scrollUntilVisible(
        find.text('Skip for now'),
        200,
        scrollable: find.byType(Scrollable).first,
      );
      await tester.tap(find.text('Skip for now'));
      await tester.pumpAndSettle();

      expect(find.text('Almost done — a few quick details'), findsOneWidget);
      // Skipping sends no sports to the backend.
      expect(userRepo.lastSports, isNull);
    });

    testWidgets('should persist selected sports with levels to the backend', (
      tester,
    ) async {
      await pumpRouter(tester);
      await tester.tap(find.text('Meet new sports partners'));
      await tester.pump();
      await tester.tap(find.text('Next'));
      await tester.pumpAndSettle();

      await tester.tap(find.text('Basketball'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Intermediate'));
      await tester.pumpAndSettle();

      await tester.scrollUntilVisible(
        find.text('Next (1 selected)'),
        200,
        scrollable: find.byType(Scrollable).first,
      );
      await tester.tap(find.text('Next (1 selected)'));
      await tester.pumpAndSettle();

      expect(find.text('Almost done — a few quick details'), findsOneWidget);
      expect(userRepo.lastSports, hasLength(1));
      expect(userRepo.lastSports!.single.sport, 'Basketball');
      expect(userRepo.lastSports!.single.level, 'Intermediate');
    });
  });

  group('GetToKnow3Screen', () {
    testWidgets('should show height, weight and date-of-birth controls', (
      tester,
    ) async {
      await pumpRouter(tester);
      await tester.tap(find.text('Meet new sports partners'));
      await tester.pump();
      await tester.tap(find.text('Next'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Skip for now'));
      await tester.pumpAndSettle();

      expect(find.text('Height'), findsOneWidget);
      expect(find.text('Weight'), findsOneWidget);
      expect(find.text('Date of Birth'), findsOneWidget);
      expect(find.text('3/3'), findsOneWidget);
    });

    testWidgets('should increment the weight when + is tapped', (tester) async {
      await pumpRouter(tester);
      await tester.tap(find.text('Meet new sports partners'));
      await tester.pump();
      await tester.tap(find.text('Next'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Skip for now'));
      await tester.pumpAndSettle();

      // Weight starts at the sensible default (70); + increments it.
      expect(find.text('70'), findsOneWidget);

      await tester.tap(find.bySemanticsLabel('Increase weight'));
      await tester.pumpAndSettle();

      expect(find.text('71'), findsOneWidget);
    });
  });
}
