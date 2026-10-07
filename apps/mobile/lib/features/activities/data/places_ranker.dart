import 'package:latlong2/latlong.dart';

import '../../../core/utils/geo.dart';
import '../domain/place_suggestion.dart';

/// A scored + ranked version of [PlaceSuggestion].
class RankedPlace {
  const RankedPlace({
    required this.suggestion,
    required this.relevance,
    required this.distanceKm,
    required this.matchedRanges,
  });

  /// Original suggestion.
  final PlaceSuggestion suggestion;

  /// How well the suggestion matches the query, 0..1.
  final double relevance;

  /// Distance from the user's current map centre, in km.
  final double distanceKm;

  /// Char ranges inside [PlaceSuggestion.label] that match the query (for in-row highlighting).
  final List<(int, int)> matchedRanges;

  /// Combined score used for final ordering.
  /// At 0 km the decay is 1.0, at 5 km ~0.37, at 10 km ~0.14, at 25 km ~0.007 — so "walkable first, city-wide second".
  double get combined => 0.65 * relevance + 0.35 * _decayedFor(distanceKm);

  static double _decayedFor(double km) {
    // exp(-km / 5km)
    final v = -km / 5.0;
    return _exp(v);
  }

  // Hand-rolled exp() so we don't pull in dart:math at the top (keeps this file cheap to import on cold start).
  static double _exp(double x) {
    // Use the identity exp(x) = e^x.
    var sum = 1.0;
    var term = 1.0;
    for (var n = 1; n < 18; n++) {
      term *= x / n;
      sum += term;
    }
    return sum < 0
        ? 0
        : sum > 1.5
        ? 1
        : sum;
  }
}

/// Ranks venue autocomplete results by combining textual relevance with distance from the user's current map view.
/// The pure ranking function lives here so it can be unit-tested without spinning up Flutter widgets.
class PlacesRanker {
  const PlacesRanker();

  /// Returns [suggestions] sorted by descending [RankedPlace.combined].
  List<RankedPlace> rank(
    List<PlaceSuggestion> suggestions,
    String query, {
    required LatLng origin,
  }) {
    final q = query.trim();
    if (q.isEmpty) {
      // No query → distance-only ordering.
      return suggestions
          .map(
            (s) => RankedPlace(
              suggestion: s,
              relevance: 0,
              distanceKm: _km(s, origin),
              matchedRanges: const [],
            ),
          )
          .toList()
        ..sort((a, b) => a.distanceKm.compareTo(b.distanceKm));
    }
    final tokens = _tokenize(q);
    final scored = <RankedPlace>[];
    for (final s in suggestions) {
      final labelTokens = _tokenize(s.label);
      final secondaryTokens = _tokenize(s.secondary);
      final ranges = _matchedRanges(s.label, tokens);
      final rel = _relevance(
        queryTokens: tokens,
        labelTokens: labelTokens,
        secondaryTokens: secondaryTokens,
        label: _normalize(s.label),
        query: _normalize(q),
      );
      if (rel <= 0) continue;
      scored.add(
        RankedPlace(
          suggestion: s,
          relevance: rel,
          distanceKm: _km(s, origin),
          matchedRanges: ranges,
        ),
      );
    }
    scored.sort((a, b) {
      final byScore = b.combined.compareTo(a.combined);
      if (byScore.abs() > 0.001) return byScore;
      return a.distanceKm.compareTo(b.distanceKm);
    });
    return scored;
  }

  // tokenisation.

  static final _tokenSplit = RegExp(r"[\s,/\-\.\(\)\[\]'’]+");
  static final _nonAlnum = RegExp(r"[^a-z0-9\u00C0-\u024F]+");

  static String _normalize(String s) {
    final lower = s.toLowerCase();
    final stripped = lower.replaceAll(_nonAlnum, ' ').trim();
    return stripped;
  }

  static List<String> _tokenize(String s) {
    final n = _normalize(s);
    if (n.isEmpty) return const [];
    return n
        .split(_tokenSplit)
        .where((t) => t.isNotEmpty)
        .toList(growable: false);
  }

  // relevance scoring.

  static double _relevance({
    required List<String> queryTokens,
    required List<String> labelTokens,
    required List<String> secondaryTokens,
    required String label,
    required String query,
  }) {
    if (queryTokens.isEmpty) return 0;

    // Tier 1: exact match (label == query).
    if (label == query) return 1.0;

    // Tier 2: label starts with the full query as a prefix.
    if (label.startsWith('$query ')) return 0.95;
    if (label.startsWith(query)) return 0.9;

    // Tier 3: every query token appears as a prefix of some label token.
    final labelSet = labelTokens.toSet();
    final everyTokenPrefixHit = queryTokens.every(
      (qt) => labelSet.any((lt) => lt.startsWith(qt)),
    );
    if (everyTokenPrefixHit) return 0.85;

    // Tier 4: every query token appears somewhere in the label tokens.
    final everyTokenHit = queryTokens.every((qt) => labelSet.contains(qt));
    if (everyTokenHit) return 0.75;

    // Tier 5: most query tokens hit (>= 50%) with token-level coverage as the score.
    final hits = queryTokens.where(labelSet.contains).length;
    final coverage = hits / queryTokens.length;
    if (coverage >= 0.5) return 0.55 + 0.2 * coverage;

    // Tier 6: secondary line.
    final secondarySet = secondaryTokens.toSet();
    final secondaryHit = queryTokens.any(secondarySet.contains);
    if (secondaryHit) return 0.4;

    // Tier 7: token-prefix hits in secondary line.
    final secondaryPrefixHit = queryTokens.any(
      (qt) => secondarySet.any((st) => st.startsWith(qt)),
    );
    if (secondaryPrefixHit) return 0.3;

    // Tier 8: substring match anywhere (cheapest fallback).
    if (label.contains(query)) return 0.25;

    // Tier 9: fuzzy match on the first label token (handles typos).
    if (labelTokens.isNotEmpty) {
      final first = labelTokens.first;
      final d = _levenshtein(query, first);
      if (d == 1) return 0.2;
      if (d == 2 && first.length >= 4) return 0.15;
    }

    // Tier 10: fuzzy match against any label token.
    for (final lt in labelTokens) {
      if (lt.length < 4) continue;
      final d = _levenshtein(query, lt);
      if (d <= 2) return 0.1;
    }

    return 0;
  }

  // distance.

  static double _km(PlaceSuggestion s, LatLng origin) =>
      haversineKm(origin.latitude, origin.longitude, s.latitude, s.longitude);

  // matched ranges (for label highlighting).

  static List<(int, int)> _matchedRanges(
    String label,
    List<String> queryTokens,
  ) {
    if (queryTokens.isEmpty) return const [];
    final ranges = <(int, int)>[];
    final lower = label.toLowerCase();
    for (final qt in queryTokens) {
      var idx = 0;
      while (true) {
        final found = lower.indexOf(qt, idx);
        if (found < 0) break;
        ranges.add((found, found + qt.length));
        idx = found + qt.length;
      }
    }
    if (ranges.isEmpty) return const [];
    ranges.sort((a, b) => a.$1.compareTo(b.$1));
    // Merge overlapping.
    final merged = <(int, int)>[];
    for (final r in ranges) {
      if (merged.isNotEmpty) {
        final last = merged.last;
        if (r.$1 <= last.$2) {
          merged[merged.length - 1] = (
            last.$1,
            r.$2 > last.$2 ? r.$2 : last.$2,
          );
          continue;
        }
      }
      merged.add(r);
    }
    return merged;
  }

  // Levenshtein distance (bounded to 32 for speed).

  static int _levenshtein(String a, String b) {
    if (a == b) return 0;
    if (a.isEmpty) return b.length;
    if (b.isEmpty) return a.length;
    final la = a.length;
    final lb = b.length;
    if ((la - lb).abs() > 3) return 4;
    var prev = List<int>.generate(lb + 1, (i) => i);
    var curr = List<int>.filled(lb + 1, 0);
    for (var i = 1; i <= la; i++) {
      curr[0] = i;
      var rowMin = curr[0];
      for (var j = 1; j <= lb; j++) {
        final cost = a.codeUnitAt(i - 1) == b.codeUnitAt(j - 1) ? 0 : 1;
        final v = [
          curr[j - 1] + 1, // insertion
          prev[j] + 1, // deletion
          prev[j - 1] + cost, // substitution
        ].reduce((x, y) => x < y ? x : y);
        curr[j] = v;
        if (v < rowMin) rowMin = v;
      }
      // Early bail-out if min in row already > 3.
      if (rowMin > 3) return 4;
      final tmp = prev;
      prev = curr;
      curr = tmp;
    }
    final d = prev[lb];
    return d > 3 ? 4 : d;
  }
}
