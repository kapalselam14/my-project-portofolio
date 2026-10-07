import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:matchup_mobile/core/providers/repository_providers.dart';
import 'package:matchup_mobile/core/services/location_service.dart';
import 'package:matchup_mobile/features/activities/data/places_repository.dart';
import 'package:matchup_mobile/features/activities/domain/place_suggestion.dart';
import 'package:matchup_mobile/features/activities/presentation/widgets/venue_picker_sheet.dart';

/// Test-only stub: returns fixed suggestions without touching the
/// network or any bundled fixtures. Verifies the picker's search UI
/// (debounce → rows → no-matches state), not a dataset.
class _StubPlacesRepository implements PlacesRepository {
  static const _suggestions = [
    PlaceSuggestion(
      placeId: 'test:stub-domain',
      label: 'Stub Domain',
      secondary: 'Testville',
      latitude: -36.85,
      longitude: 174.77,
    ),
    PlaceSuggestion(
      placeId: 'test:stub-park',
      label: 'Stub Park',
      secondary: 'Testville',
      latitude: -36.86,
      longitude: 174.78,
    ),
  ];

  @override
  Future<List<PlaceSuggestion>> autocomplete(
    String query, {
    String? countryCodes,
    String? viewbox,
  }) async {
    final q = query.trim().toLowerCase();
    if (q.length < 2) return const [];
    return _suggestions
        .where((s) => s.label.toLowerCase().contains(q))
        .toList();
  }
}

void main() {
  setUp(() {
    // Mock Geolocator so the picker doesn't stall waiting for a
    // platform channel that the test binding never provides.
    LocationService.debugGetCurrentLocation = () async => null;
  });

  tearDown(() {
    LocationService.debugGetCurrentLocation = null;
  });

  testWidgets('search renders ranked results from the places repo', (
    tester,
  ) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          placesRepositoryProvider.overrideWith((_) => _StubPlacesRepository()),
        ],
        child: MaterialApp(
          home: Builder(
            builder: (context) => Scaffold(
              body: Center(
                child: ElevatedButton(
                  onPressed: () => VenuePickerSheet.show(context),
                  child: const Text('open'),
                ),
              ),
            ),
          ),
        ),
      ),
    );
    await tester.tap(find.text('open'));
    // Don't use pumpAndSettle — the map tile requests fail in
    // tests and never settle. Use bounded pumps instead.
    await tester.pump(const Duration(milliseconds: 100));
    await tester.pump(const Duration(milliseconds: 100));

    // Type a query that matches the stub.
    await tester.enterText(find.byType(TextField).first, 'stub');
    // Wait for debounce (350ms) + generous settle.
    await tester.pump(const Duration(milliseconds: 50));
    await tester.pump(const Duration(milliseconds: 400));
    await tester.pump(const Duration(milliseconds: 100));

    // The "Searching…" title should be gone and we should see
    // at least one rendered row.
    expect(find.text('Searching…'), findsNothing);
    expect(find.text('Stub Domain'), findsOneWidget);
    expect(find.text('No matches'), findsNothing);
  });
}
