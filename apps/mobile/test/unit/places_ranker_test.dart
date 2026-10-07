import 'package:flutter_test/flutter_test.dart';
import 'package:latlong2/latlong.dart';
import 'package:matchup_mobile/features/activities/data/places_ranker.dart';
import 'package:matchup_mobile/features/activities/domain/place_suggestion.dart';

PlaceSuggestion _s(
  String label,
  String secondary, {
  required double lat,
  required double lng,
}) {
  return PlaceSuggestion(
    placeId: 'pid:$label',
    label: label,
    secondary: secondary,
    latitude: lat,
    longitude: lng,
  );
}

void main() {
  // Origin near central Auckland.
  const auckland = LatLng(-36.8485, 174.7633);

  // Test fixtures — labels chosen to exercise the ranker tiers.
  final fixtures = <PlaceSuggestion>[
    _s(
      'Auckland Domain',
      'Grafton, Auckland',
      lat: -36.8558,
      lng: 174.7764,
    ), // exact / prefix tier, ~1km
    _s(
      'Domain Park',
      'Auckland',
      lat: -36.8600,
      lng: 174.7800,
    ), // token prefix, ~1.4km
    _s(
      'Auckland Museum',
      'Auckland CBD',
      lat: -36.8610,
      lng: 174.7780,
    ), // token match, ~1.5km
    _s(
      'Mount Eden',
      'Auckland',
      lat: -36.8780,
      lng: 174.7640,
    ), // secondary only hit, ~3.3km
    _s(
      'Cornwall Park',
      'Auckland',
      lat: -36.8888,
      lng: 174.7770,
    ), // substring, ~4.6km
    _s(
      'Riverside Court',
      'Jakarta',
      lat: -6.2088,
      lng: 106.8456,
    ), // far away, no match
    _s('Takapuna Beach', 'Auckland', lat: -36.7870, lng: 174.7750), // ~7km, far
  ];

  group('PlacesRanker', () {
    test('exact match ranks first', () {
      final ranked = const PlacesRanker().rank(
        fixtures,
        'Auckland Domain',
        origin: auckland,
      );
      expect(ranked, isNotEmpty);
      expect(ranked.first.suggestion.label, 'Auckland Domain');
      expect(ranked.first.relevance, 1.0);
    });

    test('prefix match outranks a partial token match', () {
      final ranked = const PlacesRanker().rank(
        fixtures,
        'Auckland',
        origin: auckland,
      );
      // "Auckland Domain" (prefix + secondary) should beat
      // "Cornwall Park" (substring hit on the query string).
      final top = ranked.take(3).map((r) => r.suggestion.label).toList();
      expect(top.first, 'Auckland Domain');
      expect(top, contains('Auckland Museum'));
    });

    test('faster typing a typo still finds the venue (Levenshtein)', () {
      final ranked = const PlacesRanker().rank(
        fixtures,
        'Aucklabd', // 1 transposition from "Auckland"
        origin: auckland,
      );
      expect(
        ranked,
        isNotEmpty,
        reason: 'typo "Aucklabd" should still find Auckland entries',
      );
      expect(ranked.first.suggestion.label.toLowerCase(), contains('auckland'));
    });

    test('multi-word query matches venue with any token order', () {
      final ranked = const PlacesRanker().rank(
        fixtures,
        'Domain Auckland',
        origin: auckland,
      );
      // Auckland Domain has both tokens as prefixes; should rank
      // higher than Domain Park (only "Domain" as prefix).
      final top = ranked.take(2).map((r) => r.suggestion.label).toList();
      expect(top.first, 'Auckland Domain');
    });

    test('closer-but-irrelevant result ranks below farther-but-relevant', () {
      // Cornwall Park is far but contains the query string
      // ("auckland" matches the secondary text). Takapuna is closer
      // but has nothing to do with the query.
      final ranked = const PlacesRanker().rank(
        [fixtures[4], fixtures[6]], // Cornwall Park + Takapuna
        'Auckland',
        origin: auckland,
      );
      expect(ranked.first.suggestion.label, 'Cornwall Park');
      expect(ranked.first.relevance, greaterThan(0));
    });

    test('distance dominates when relevance is similar', () {
      // Two Auckland-prefixed venues at different distances.
      final ranked = const PlacesRanker().rank(
        [fixtures[2], fixtures[0]], // Museum, Domain
        'Auckland',
        origin: auckland,
      );
      // Domain is closer than Museum so should rank first when
      // relevance ties.
      expect(ranked.first.suggestion.label, 'Auckland Domain');
    });

    test('empty query returns distance-sorted results', () {
      final ranked = const PlacesRanker().rank(fixtures, '', origin: auckland);
      expect(ranked.length, fixtures.length);
      expect(ranked.first.suggestion.label, 'Auckland Domain');
      // Jakarta venue is the farthest.
      expect(ranked.last.suggestion.label, 'Riverside Court');
    });

    test('matchedRanges cover the searched tokens', () {
      final ranked = const PlacesRanker().rank(
        fixtures,
        'Domain',
        origin: auckland,
      );
      // Domain Park should have a hit somewhere in "Domain".
      final dp = ranked.firstWhere(
        (r) => r.suggestion.label == 'Domain Park',
        orElse: () => ranked.first,
      );
      expect(dp.matchedRanges, isNotEmpty);
      final firstHit = dp.matchedRanges.first;
      expect(
        dp.suggestion.label.substring(firstHit.$1, firstHit.$2).toLowerCase(),
        'domain',
      );
    });

    test('irrelevant query yields zero results', () {
      final ranked = const PlacesRanker().rank(
        fixtures,
        'zzzzzzz',
        origin: auckland,
      );
      expect(ranked, isEmpty);
    });
  });
}
