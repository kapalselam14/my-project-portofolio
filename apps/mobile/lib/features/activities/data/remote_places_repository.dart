import 'package:flutter/foundation.dart';

import '../../../core/network/api_client.dart';
import '../domain/place_suggestion.dart';
import 'places_repository.dart';

/// HTTP-backed [PlacesRepository].
class RemotePlacesRepository implements PlacesRepository {
  RemotePlacesRepository({ApiClient? client})
    : _client = client ?? ApiClient.instance;

  final ApiClient _client;

  @override
  Future<List<PlaceSuggestion>> autocomplete(
    String query, {
    String? countryCodes,
    String? viewbox,
  }) async {
    final trimmed = query.trim();
    if (trimmed.length < 3) return const <PlaceSuggestion>[];

    try {
      final res = await _client.dio.get(
        '/places/autocomplete',
        queryParameters: {
          'q': trimmed,
          if (countryCodes != null && countryCodes.isNotEmpty)
            'countryCodes': countryCodes,
          if (viewbox != null && viewbox.isNotEmpty) 'viewbox': viewbox,
        },
      );
      return apiDataList(res.data)
          .whereType<Map<String, dynamic>>()
          .map(PlaceSuggestion.fromJson)
          .toList();
    } catch (e, st) {
      debugPrint('[RemotePlacesRepository.autocomplete] $e\n$st');
      return const <PlaceSuggestion>[];
    }
  }
}
