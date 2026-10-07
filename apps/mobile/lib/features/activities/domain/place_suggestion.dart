/// One venue suggestion from the places autocomplete proxy (`GET /api/places/autocomplete`).
class PlaceSuggestion {
  const PlaceSuggestion({
    required this.placeId,
    required this.label,
    required this.secondary,
    required this.latitude,
    required this.longitude,
  });

  final String placeId;
  final String label;
  final String secondary;
  final double latitude;
  final double longitude;

  factory PlaceSuggestion.fromJson(Map<String, dynamic> json) {
    return PlaceSuggestion(
      placeId: json['placeId']?.toString() ?? '',
      label: json['label'] as String? ?? '',
      secondary: json['secondary'] as String? ?? '',
      latitude: (json['latitude'] as num?)?.toDouble() ?? 0,
      longitude: (json['longitude'] as num?)?.toDouble() ?? 0,
    );
  }
}
