import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:mocktail/mocktail.dart';

import 'package:matchup_mobile/core/providers/repository_providers.dart';
import 'package:matchup_mobile/features/profile/data/user_repository.dart';
import 'package:matchup_mobile/features/profile/domain/user_model.dart';
import 'package:matchup_mobile/features/profile/presentation/edit_profile_screen.dart';

class _MockUserRepository extends Mock implements UserRepository {}

UserModel _fixture() => UserModel(
  id: 'me',
  displayName: 'Jordan Lee',
  bio: 'Weekend athlete.',
  email: 'jordan@email.com',
  phone: '+64 21 000 0000',
  location: 'Wellington, NZ',
  dateOfBirth: DateTime(1998, 5, 12),
  heightCm: 178,
  weightKg: 70,
  goal: 'Train for a 10k',
  sports: const [(sport: 'Cycling', level: 'Intermediate')],
);

void main() {
  late _MockUserRepository userRepo;

  setUp(() {
    userRepo = _MockUserRepository();
    when(() => userRepo.me()).thenAnswer((_) async => _fixture());
    when(
      () => userRepo.updateProfile(
        displayName: any(named: 'displayName'),
        bio: any(named: 'bio'),
        location: any(named: 'location'),
        email: any(named: 'email'),
        phone: any(named: 'phone'),
        dateOfBirth: any(named: 'dateOfBirth'),
        heightCm: any(named: 'heightCm'),
        weightKg: any(named: 'weightKg'),
        goal: any(named: 'goal'),
        sports: any(named: 'sports'),
      ),
    ).thenAnswer((_) async => _fixture());
  });

  Future<void> pumpScreen(WidgetTester tester) async {
    final router = GoRouter(
      initialLocation: '/home',
      routes: [
        GoRoute(
          path: '/home',
          builder: (context, _) => Scaffold(
            body: Center(
              child: TextButton(
                onPressed: () => context.push('/edit-profile'),
                child: const Text('Open Edit Profile'),
              ),
            ),
          ),
        ),
        GoRoute(
          path: '/edit-profile',
          builder: (_, _) => const EditProfileScreen(),
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
    await tester.tap(find.text('Open Edit Profile'));
    await tester.pumpAndSettle();
  }

  group('EditProfileScreen', () {
    testWidgets(
      'should populate fields from real user data, not hardcoded seed values',
      (tester) async {
        await pumpScreen(tester);

        expect(find.text('Jordan Lee'), findsOneWidget);
        expect(find.text('jordan@email.com'), findsOneWidget);
        // The old hardcoded seed was 'alex@email.com' — must not appear.
        expect(find.text('alex@email.com'), findsNothing);
      },
    );

    testWidgets('should call updateProfile with edited values on save', (
      tester,
    ) async {
      await pumpScreen(tester);

      await tester.enterText(find.text('Jordan Lee'), 'Jordan Lee Jr.');
      final saveFinder = find.text('Save Changes');
      await tester.ensureVisible(saveFinder);
      await tester.pumpAndSettle();
      await tester.tap(saveFinder);
      await tester.pumpAndSettle();

      verify(
        () => userRepo.updateProfile(
          displayName: 'Jordan Lee Jr.',
          bio: any(named: 'bio'),
          location: any(named: 'location'),
          email: any(named: 'email'),
          phone: any(named: 'phone'),
          dateOfBirth: any(named: 'dateOfBirth'),
          heightCm: any(named: 'heightCm'),
          weightKg: any(named: 'weightKg'),
          goal: any(named: 'goal'),
          sports: any(named: 'sports'),
        ),
      ).called(1);
    });

    testWidgets('weight and goal are editable and persist on save', (
      tester,
    ) async {
      await pumpScreen(tester);

      // Regression: both fields used to be disabled with a
      // "not synced" caption even though PATCH /me persists them.
      await tester.enterText(find.text('70'), '75');
      await tester.enterText(find.text('Train for a 10k'), 'Run a marathon');
      final saveFinder = find.text('Save Changes');
      await tester.ensureVisible(saveFinder);
      await tester.pumpAndSettle();
      await tester.tap(saveFinder);
      await tester.pumpAndSettle();

      verify(
        () => userRepo.updateProfile(
          displayName: any(named: 'displayName'),
          bio: any(named: 'bio'),
          location: any(named: 'location'),
          email: any(named: 'email'),
          phone: any(named: 'phone'),
          dateOfBirth: any(named: 'dateOfBirth'),
          heightCm: any(named: 'heightCm'),
          weightKg: 75,
          goal: 'Run a marathon',
          sports: any(named: 'sports'),
        ),
      ).called(1);
    });

    testWidgets(
      'tapping Change Photo uploads the picked image and shows success',
      (tester) async {
        // Mock the image_picker platform channel (verified against
        // image_picker_platform_interface: channel
        // 'plugins.flutter.io/image_picker', method 'pickImage'
        // returning the picked file path).
        const pickerChannel = MethodChannel('plugins.flutter.io/image_picker');
        TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
            .setMockMethodCallHandler(pickerChannel, (call) async {
              return '/tmp/picked-avatar.jpg';
            });
        addTearDown(
          () => TestDefaultBinaryMessengerBinding
              .instance
              .defaultBinaryMessenger
              .setMockMethodCallHandler(pickerChannel, null),
        );
        when(
          () => userRepo.uploadAvatar(localPath: any(named: 'localPath')),
        ).thenAnswer((_) async => _fixture());

        await pumpScreen(tester);

        await tester.tap(find.text('Change Photo'));
        await tester.pumpAndSettle();

        // Source chooser (same modal as the create flow): pick Gallery.
        await tester.tap(find.text('Gallery'));
        await tester.pumpAndSettle();

        verify(
          () => userRepo.uploadAvatar(localPath: '/tmp/picked-avatar.jpg'),
        ).called(1);
        expect(find.text('Profile photo updated.'), findsOneWidget);
      },
    );

    testWidgets(
      'should prompt to discard unsaved changes when back is tapped',
      (tester) async {
        await pumpScreen(tester);

        await tester.enterText(find.text('Jordan Lee'), 'Changed Name');
        await tester.pump();

        await tester.tap(find.bySemanticsLabel('Back'));
        await tester.pumpAndSettle();

        expect(find.text('Discard changes?'), findsOneWidget);

        // Cancel — stay on the edit screen.
        await tester.tap(find.text('Keep editing'));
        await tester.pumpAndSettle();
        expect(find.text('Changed Name'), findsOneWidget);
      },
    );
  });
}
