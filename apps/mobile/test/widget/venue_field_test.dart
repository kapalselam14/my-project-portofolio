import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:matchup_mobile/core/providers/repository_providers.dart';
import 'package:matchup_mobile/features/activities/data/local_places_repository.dart';
import 'package:matchup_mobile/features/activities/presentation/widgets/venue_field.dart';
import 'package:matchup_mobile/features/activities/domain/place_suggestion.dart';

void main() {
  testWidgets(
    'VenueField renders inside a constrained parent without throwing',
    (tester) async {
      // Regression: the field used to drop its parent Card's
      // measurements when the suggestions list grew, which caused
      // RenderFlex overflows in the create-wizard layout. The list is
      // now an absolutely positioned overlay (no flow participation),
      // so the field itself must stay inside its parent's intrinsic
      // size.
      await tester.pumpWidget(
        ProviderScope(
          // Local-only repo so this test does not depend on the
          // network and produces no suggestions.
          overrides: [
            placesRepositoryProvider.overrideWith(
              (_) => LocalPlacesRepository(),
            ),
          ],
          child: MaterialApp(
            home: Material(
              child: Scaffold(
                body: SizedBox(
                  width: 360,
                  child: VenueField(value: null, onSuggestionSelected: (_) {}),
                ),
              ),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Pick a venue on the map'), findsOneWidget);
    },
  );

  testWidgets('VenueField shows the picked venue address under its name', (
    tester,
  ) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          placesRepositoryProvider.overrideWith((_) => LocalPlacesRepository()),
        ],
        child: MaterialApp(
          home: Material(
            child: Scaffold(
              body: SizedBox(
                width: 360,
                child: VenueField(
                  value: const PlaceSuggestion(
                    placeId: 'p1',
                    label: 'Eden Park',
                    secondary: 'Reimers Ave, Kingsland, Auckland',
                    latitude: -36.875,
                    longitude: 174.745,
                  ),
                  onSuggestionSelected: (_) {},
                ),
              ),
            ),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Eden Park'), findsOneWidget);
    expect(find.text('Reimers Ave, Kingsland, Auckland'), findsOneWidget);
  });
}
