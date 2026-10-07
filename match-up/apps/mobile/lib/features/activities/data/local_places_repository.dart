import '../domain/place_suggestion.dart';
import 'places_repository.dart';

/// Offline-only places fallback.
/// Kept as a class (rather than deleted) so widget tests can override the provider without touching the network.
class LocalPlacesRepository implements PlacesRepository {
  @override
  Future<List<PlaceSuggestion>> autocomplete(
    String query, {
    String? countryCodes,
    String? viewbox,
  }) async {
    return const [];
  }
}
