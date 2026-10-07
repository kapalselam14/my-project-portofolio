import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:geolocator/geolocator.dart';
import 'package:matchup_mobile/core/providers/repository_providers.dart';
import 'package:matchup_mobile/core/services/location_service.dart';
import 'package:matchup_mobile/features/activities/presentation/check_in_screen.dart';
import 'package:matchup_mobile/features/discovery/data/activity_repository.dart';
import 'package:matchup_mobile/features/discovery/domain/activity_model.dart';
import 'package:mocktail/mocktail.dart';

class _MockActivityRepository extends Mock implements ActivityRepository {}

Position _pos(double lat, double lng) => Position(
  latitude: lat,
  longitude: lng,
  timestamp: DateTime.now(),
  accuracy: 5,
  altitude: 0,
  altitudeAccuracy: 1,
  heading: 0,
  headingAccuracy: 1,
  speed: 0,
  speedAccuracy: 1,
);

ActivityModel _activity({required DateTime start}) => ActivityModel(
  id: 'c-1',
  title: 'Morning Run',
  sportType: 'Running',
  description: 'Easy laps.',
  location: 'Auckland Domain',
  distanceKm: 1.0,
  dateTime: start,
  skillLevel: 'Beginner',
  capacity: 10,
  participantCount: 4,
  hostName: 'Sam',
  latitude: -36.8558,
  longitude: 174.7764,
);

Future<void> _pump(
  WidgetTester tester,
  _MockActivityRepository repo,
  ActivityModel activity,
) async {
  await tester.pumpWidget(
    ProviderScope(
      overrides: [activityRepositoryProvider.overrideWithValue(repo)],
      child: const MaterialApp(home: CheckInScreen(activityId: 'c-1')),
    ),
  );
  await tester.pump();
  await tester.pump(const Duration(milliseconds: 100));
}

void main() {
  late _MockActivityRepository repo;

  setUp(() {
    repo = _MockActivityRepository();
    when(() => repo.byId(any())).thenAnswer((_) async => null);
    when(() => repo.isCheckedIn(any())).thenAnswer((_) async => false);
    when(
      () => repo.checkIn(
        activityId: any(named: 'activityId'),
        latitude: any(named: 'latitude'),
        longitude: any(named: 'longitude'),
      ),
    ).thenAnswer((_) async {});
  });

  tearDown(() {
    LocationService.debugGetCurrentLocation = null;
  });

  testWidgets('eligible user (near + in window) can check in', (tester) async {
    final start = DateTime.now().add(const Duration(minutes: 10));
    when(
      () => repo.byId('c-1'),
    ).thenAnswer((_) async => _activity(start: start));
    // GPS exactly at the venue.
    LocationService.debugGetCurrentLocation = () async =>
        _pos(-36.8558, 174.7764);

    await _pump(tester, repo, _activity(start: start));

    expect(find.text('You are at the venue'), findsOneWidget);
    await tester.scrollUntilVisible(find.text('Check In'), 200);
    await tester.tap(find.text('Check In'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 100));
    expect(find.text('Checked in!'), findsOneWidget);
    verify(
      () => repo.checkIn(
        activityId: 'c-1',
        latitude: any(named: 'latitude'),
        longitude: any(named: 'longitude'),
      ),
    ).called(1);
  });

  testWidgets('failed persist shows error and reverts to not checked in', (
    tester,
  ) async {
    final start = DateTime.now().add(const Duration(minutes: 10));
    when(
      () => repo.byId('c-1'),
    ).thenAnswer((_) async => _activity(start: start));
    when(
      () => repo.checkIn(
        activityId: any(named: 'activityId'),
        latitude: any(named: 'latitude'),
        longitude: any(named: 'longitude'),
      ),
    ).thenThrow(Exception('offline'));
    LocationService.debugGetCurrentLocation = () async =>
        _pos(-36.8558, 174.7764);

    await _pump(tester, repo, _activity(start: start));

    await tester.scrollUntilVisible(find.text('Check In'), 200);
    await tester.tap(find.text('Check In'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 100));
    expect(find.text('Checked in!'), findsNothing);
    expect(find.text('Could not check in. Please try again.'), findsOneWidget);
  });

  testWidgets('already checked in restores checked-in state on init', (
    tester,
  ) async {
    final start = DateTime.now().add(const Duration(minutes: 10));
    when(
      () => repo.byId('c-1'),
    ).thenAnswer((_) async => _activity(start: start));
    when(() => repo.isCheckedIn('c-1')).thenAnswer((_) async => true);
    LocationService.debugGetCurrentLocation = () async =>
        _pos(-36.8558, 174.7764);

    await _pump(tester, repo, _activity(start: start));

    expect(find.text('Checked in!'), findsOneWidget);
  });

  testWidgets('too early shows when the window opens', (tester) async {
    final start = DateTime.now().add(const Duration(hours: 2));
    when(
      () => repo.byId('c-1'),
    ).thenAnswer((_) async => _activity(start: start));
    LocationService.debugGetCurrentLocation = () async =>
        _pos(-36.8558, 174.7764);

    await _pump(tester, repo, _activity(start: start));

    expect(find.text('Not open yet'), findsOneWidget);
    // Button is dimmed (Opacity 0.45 wraps it) — tap does nothing.
    await tester.scrollUntilVisible(find.text('Check In'), 200);
    await tester.tap(find.text('Check In'), warnIfMissed: false);
    await tester.pump(const Duration(milliseconds: 100));
    expect(find.text('Checked in!'), findsNothing);
  });

  testWidgets('far away shows distance reason', (tester) async {
    final start = DateTime.now().add(const Duration(minutes: 10));
    when(
      () => repo.byId('c-1'),
    ).thenAnswer((_) async => _activity(start: start));
    // GPS ~11 km away (central Auckland motel strip).
    LocationService.debugGetCurrentLocation = () async =>
        _pos(-36.8485, 174.7633);

    await _pump(tester, repo, _activity(start: start));

    expect(find.text('You are not at the venue yet'), findsOneWidget);
    await tester.scrollUntilVisible(find.text('Check In'), 200);
    await tester.tap(find.text('Check In'), warnIfMissed: false);
    await tester.pump(const Duration(milliseconds: 100));
    expect(find.text('Checked in!'), findsNothing);
  });

  testWidgets('ended activity shows closed', (tester) async {
    final start = DateTime.now().subtract(const Duration(hours: 3));
    when(
      () => repo.byId('c-1'),
    ).thenAnswer((_) async => _activity(start: start));
    LocationService.debugGetCurrentLocation = () async =>
        _pos(-36.8558, 174.7764);

    await _pump(tester, repo, _activity(start: start));

    expect(find.text('Check-in closed'), findsOneWidget);
  });
}
