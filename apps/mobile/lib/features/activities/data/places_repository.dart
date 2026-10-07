import '../../activities/domain/place_suggestion.dart';

/// Read contract for venue autocomplete (`GET /api/places/autocomplete`).
abstract class PlacesRepository {
  /// Returns venue suggestions for [query].
  Future<List<PlaceSuggestion>> autocomplete(
    String query, {
    String? countryCodes,

    /// Nominatim viewbox bias (`"left,top,right,bottom"` in degrees).
    String? viewbox,
  });
}
