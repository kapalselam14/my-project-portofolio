import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:mocktail/mocktail.dart';

import 'package:matchup_mobile/core/providers/repository_providers.dart';
import 'package:matchup_mobile/features/profile/data/user_repository.dart';
import 'package:matchup_mobile/features/profile/domain/user_model.dart';
import 'package:matchup_mobile/features/profile/presentation/player_profile_screen.dart';

class _MockUserRepository extends Mock implements UserRepository {}

void main() {
  late _MockUserRepository userRepo;

  setUp(() {
    userRepo = _MockUserRepository();
  });

  Future<void> pumpScreen(WidgetTester tester) async {
    final router = GoRouter(
      initialLocation: '/player-profile/uid/james',
      routes: [
        GoRoute(
          path: '/player-profile/uid/:uid',
          builder: (_, state) =>
              PlayerProfileScreen.byUid(userId: state.pathParameters['uid']!),
        ),
        GoRoute(
          path: '/chat/:title',
          builder: (_, _) => const Scaffold(body: Text('Chat')),
        ),
        GoRoute(
          path: '/dm/:uid',
          builder: (_, state) =>
              Scaffold(body: Text('DM ${state.pathParameters['uid']}')),
        ),
        GoRoute(
          path: '/report/:type/:name',
          builder: (_, _) => const Scaffold(body: Text('Report')),
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

  group('PlayerProfileScreen', () {
    testWidgets('should render user details and stats', (tester) async {
      when(() => userRepo.byId('james')).thenAnswer(
        (_) async => const UserModel(
          id: 'james',
          displayName: 'James Wilson',
          rating: 4.9,
          activitiesCount: 24,
          hostedCount: 8,
          bio: 'Weekend warrior.',
          sports: [(sport: 'Basketball', level: 'Intermediate')],
        ),
      );

      await pumpScreen(tester);

      expect(find.text('JAMES WILSON'), findsOneWidget);
      expect(find.text('24'), findsOneWidget);
      expect(find.text('8'), findsOneWidget);
      expect(find.text('Send Message'), findsOneWidget);
      expect(find.text('Report Profile'), findsOneWidget);
    });

    testWidgets('should show a not-found message when the player is null', (
      tester,
    ) async {
      when(() => userRepo.byId('james')).thenAnswer((_) async => null);
      await pumpScreen(tester);
      expect(find.text('Player not found.'), findsOneWidget);
    });

    testWidgets('should show age and height chips when shared', (tester) async {
      final now = DateTime.now();
      final dob = DateTime(now.year - 24, now.month, now.day);
      when(() => userRepo.byId('james')).thenAnswer(
        (_) async => UserModel(
          id: 'james',
          displayName: 'James Wilson',
          dateOfBirth: dob,
          heightCm: 178,
        ),
      );

      await pumpScreen(tester);

      expect(find.text('24 yrs'), findsOneWidget);
      expect(find.text('178 cm'), findsOneWidget);
    });

    testWidgets('should hide physical chips when not shared', (tester) async {
      when(() => userRepo.byId('james')).thenAnswer(
        (_) async => const UserModel(id: 'james', displayName: 'James Wilson'),
      );

      await pumpScreen(tester);

      expect(find.textContaining('yrs'), findsNothing);
      expect(find.textContaining('cm'), findsNothing);
    });

    testWidgets('name constructor shows the unavailable empty state', (
      tester,
    ) async {
      final router = GoRouter(
        initialLocation: '/player-profile/James',
        routes: [
          GoRoute(
            path: '/player-profile/:name',
            builder: (_, state) =>
                PlayerProfileScreen(playerName: state.pathParameters['name']!),
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

      // No backend name search exists — byId must never be attempted.
      verifyNever(() => userRepo.byId(any()));
      expect(find.text('Profile not available'), findsOneWidget);
      expect(
        find.text('Open this profile from the roster to see details.'),
        findsOneWidget,
      );
      expect(find.text('Back'), findsWidgets);
    });

    testWidgets('should open the DM thread when Send Message is tapped', (
      tester,
    ) async {
      when(() => userRepo.byId('james')).thenAnswer(
        (_) async => const UserModel(id: 'james', displayName: 'James Wilson'),
      );
      await pumpScreen(tester);

      await tester.tap(find.text('Send Message'));
      await tester.pumpAndSettle();

      expect(find.text('DM james'), findsOneWidget);
    });

    testWidgets('should show sport with fallback skill level', (tester) async {
      when(() => userRepo.byId('james')).thenAnswer(
        (_) async => const UserModel(
          id: 'james',
          displayName: 'James Wilson',
          sports: [(sport: 'Basketball', level: '')],
          skillLevel: 'Intermediate',
        ),
      );
      await pumpScreen(tester);

      expect(find.text('Basketball'), findsOneWidget);
      // Empty per-sport level falls back to the general skill level.
      expect(find.text('INTERMEDIATE'), findsOneWidget);
    });

    testWidgets('should hide the level badge when unknown', (tester) async {
      when(() => userRepo.byId('james')).thenAnswer(
        (_) async => const UserModel(
          id: 'james',
          displayName: 'James Wilson',
          sports: [(sport: 'Basketball', level: '')],
        ),
      );
      await pumpScreen(tester);

      expect(find.text('Basketball'), findsOneWidget);
      expect(find.text('INTERMEDIATE'), findsNothing);
    });

    testWidgets('should open the options sheet from More options', (
      tester,
    ) async {
      when(() => userRepo.byId('james')).thenAnswer(
        (_) async => const UserModel(id: 'james', displayName: 'James Wilson'),
      );
      await pumpScreen(tester);

      await tester.tap(find.bySemanticsLabel('More options'));
      await tester.pumpAndSettle();

      expect(find.text('Share profile'), findsOneWidget);
      expect(find.text('Report profile'), findsOneWidget);
    });

    testWidgets('byUid constructor looks the profile up by auth uid', (
      tester,
    ) async {
      when(() => userRepo.byId('u-9')).thenAnswer(
        (_) async => const UserModel(
          id: 'u-9',
          displayName: 'Sam Rivera',
          activitiesCount: 3,
          hostedCount: 1,
        ),
      );

      final router = GoRouter(
        initialLocation: '/player-profile/uid/u-9',
        routes: [
          GoRoute(
            path: '/player-profile/uid/:uid',
            builder: (_, state) =>
                PlayerProfileScreen.byUid(userId: state.pathParameters['uid']!),
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

      // Exact uid lookup — the display name is rendered from the
      // loaded model, never from the URL.
      verify(() => userRepo.byId('u-9')).called(greaterThanOrEqualTo(1));
      expect(find.text('SAM RIVERA'), findsOneWidget);
    });
  });
}
