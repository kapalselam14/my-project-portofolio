import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:matchup_mobile/core/providers/repository_providers.dart';
import 'package:matchup_mobile/features/appeals/data/appeal_repository.dart';
import 'package:matchup_mobile/features/appeals/domain/appeal_model.dart';
import 'package:matchup_mobile/features/appeals/presentation/suspended_screen.dart';
import 'package:shared_preferences/shared_preferences.dart';

class _FakeAppealRepository implements AppealRepository {
  _FakeAppealRepository(this.appeals);

  final List<AppealModel> appeals;
  String? lastStatement;

  @override
  Future<List<AppealModel>> myAppeals() async => appeals;

  @override
  Future<AppealModel> submitSuspensionAppeal({
    required String statement,
  }) async {
    lastStatement = statement;
    const created = AppealModel(
      id: 'ap-new',
      type: 'suspension',
      statement: '',
      status: AppealStatus.pending,
    );
    appeals.insert(0, created);
    return created;
  }
}

const _pending = AppealModel(
  id: 'ap-1',
  type: 'suspension',
  statement: 'Please review.',
  status: AppealStatus.pending,
);

Future<void> _pump(WidgetTester tester, List<AppealModel> appeals) async {
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        appealRepositoryProvider.overrideWithValue(
          _FakeAppealRepository(appeals),
        ),
      ],
      child: const MaterialApp(home: SuspendedScreen()),
    ),
  );
  await tester.pumpAndSettle();
}

void main() {
  setUp(() => SharedPreferences.setMockInitialValues({}));

  testWidgets('shows the appeal form when nothing is pending', (tester) async {
    await _pump(tester, []);
    expect(find.text('Your account is suspended'), findsOneWidget);
    expect(find.text('Submit appeal'), findsOneWidget);
    expect(find.text('Appeal under review'), findsNothing);
  });

  testWidgets('shows pending state instead of the form', (tester) async {
    await _pump(tester, [_pending]);
    expect(find.text('Appeal under review'), findsOneWidget);
    expect(find.text('Submit appeal'), findsNothing);
  });

  testWidgets('submitting adds the appeal to review', (tester) async {
    await _pump(tester, []);
    await tester.enterText(
      find.byType(TextField),
      'I believe this was a mistake.',
    );
    await tester.tap(find.text('Submit appeal'));
    await tester.pumpAndSettle();
    expect(find.text('Appeal under review'), findsOneWidget);
  });

  testWidgets('rejected appeal shows the admin note', (tester) async {
    await _pump(tester, const [
      AppealModel(
        id: 'ap-2',
        type: 'suspension',
        statement: 'Please.',
        status: AppealStatus.rejected,
        adminNote: 'Upheld after review.',
      ),
    ]);
    expect(find.text('Appeal not approved'), findsOneWidget);
    expect(find.textContaining('Upheld after review.'), findsOneWidget);
  });

  testWidgets('short statements are rejected with a min-length message', (
    tester,
  ) async {
    await _pump(tester, []);
    await tester.enterText(find.byType(TextField), 'Too short.');
    await tester.tap(find.text('Submit appeal'));
    await tester.pumpAndSettle();
    expect(find.text('Appeal under review'), findsNothing);
  });

  testWidgets('shows labeled loading state', (tester) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          appealRepositoryProvider.overrideWithValue(
            _HangingAppealRepository(),
          ),
        ],
        child: const MaterialApp(home: SuspendedScreen()),
      ),
    );
    await tester.pump();
    expect(find.text('Checking your account…'), findsOneWidget);
    expect(find.text('Retry'), findsOneWidget);
  });
}

class _HangingAppealRepository implements AppealRepository {
  final _gate = Completer<List<AppealModel>>();

  @override
  Future<List<AppealModel>> myAppeals() => _gate.future;

  @override
  Future<AppealModel> submitSuspensionAppeal({required String statement}) =>
      throw UnimplementedError();
}
