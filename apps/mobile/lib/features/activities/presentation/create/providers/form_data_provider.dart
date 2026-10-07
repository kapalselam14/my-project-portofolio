import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Sentinel distinguishing "argument omitted" from an explicit null.
const _unset = Object();

/// Form data model for the wizard
class ActivityFormData {
  final String title;
  final String sportType;

  /// Local file path of the cover image picked by the user, if any.
  final String? coverImagePath;
  final DateTime? selectedDate;
  final String location;

  /// Full address of the picked venue (`PlaceSuggestion.secondary`).
  final String venueAddress;

  /// Picked venue coordinates.
  final double? venueLatitude;
  final double? venueLongitude;
  final String description;
  final int maxParticipants;
  final String skillLevel;
  final int feeType; // 0 = Free, 1 = Paid
  final String? price;

  /// Paid pricing mode: 0 = Fixed per person, 1 = Split total cost.
  final int priceMode;

  /// Minimum players for split mode (worst-case divisor).
  final int? minPlayers;

  /// How long the activity runs, in minutes.
  final int durationMinutes;

  /// Who can discover and join: 'Public', 'Friends', or 'Invite only'.
  final String visibility;

  /// Backend join policy: 'open' (instant join) or 'approval' (host must approve each request).
  final String joinPolicy;

  const ActivityFormData({
    this.title = '',
    this.sportType = 'Basketball',
    this.coverImagePath,
    this.selectedDate,
    this.location = '',
    this.venueAddress = '',
    this.venueLatitude,
    this.venueLongitude,
    this.description = '',
    this.maxParticipants = 10,
    this.skillLevel = 'Intermediate',
    this.feeType = 0,
    this.price,
    this.priceMode = 0,
    this.minPlayers,
    this.durationMinutes = 120,
    this.visibility = 'Public',
    this.joinPolicy = 'open',
  });

  ActivityFormData copyWith({
    String? title,
    String? sportType,
    String? coverImagePath,
    DateTime? selectedDate,
    String? location,
    String? venueAddress,
    double? venueLatitude,
    double? venueLongitude,
    String? description,
    int? maxParticipants,
    String? skillLevel,
    int? feeType,
    String? price,
    int? priceMode,
    // Nullable on purpose: passing an explicit null CLEARS the minimum (full house).
    Object? minPlayers = _unset,
    int? durationMinutes,
    String? visibility,
    String? joinPolicy,
  }) {
    return ActivityFormData(
      title: title ?? this.title,
      sportType: sportType ?? this.sportType,
      coverImagePath: coverImagePath ?? this.coverImagePath,
      selectedDate: selectedDate ?? this.selectedDate,
      location: location ?? this.location,
      venueAddress: venueAddress ?? this.venueAddress,
      venueLatitude: venueLatitude ?? this.venueLatitude,
      venueLongitude: venueLongitude ?? this.venueLongitude,
      description: description ?? this.description,
      maxParticipants: maxParticipants ?? this.maxParticipants,
      skillLevel: skillLevel ?? this.skillLevel,
      feeType: feeType ?? this.feeType,
      price: price ?? this.price,
      priceMode: priceMode ?? this.priceMode,
      minPlayers: identical(minPlayers, _unset)
          ? this.minPlayers
          : minPlayers as int?,
      durationMinutes: durationMinutes ?? this.durationMinutes,
      visibility: visibility ?? this.visibility,
      joinPolicy: joinPolicy ?? this.joinPolicy,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'title': title,
      'sportType': sportType,
      'coverImagePath': coverImagePath,
      'selectedDate': selectedDate?.toIso8601String(),
      'location': location,
      'venueAddress': venueAddress,
      'venueLatitude': venueLatitude,
      'venueLongitude': venueLongitude,
      'description': description,
      'maxParticipants': maxParticipants,
      'skillLevel': skillLevel,
      'feeType': feeType,
      'price': price,
      'priceMode': priceMode,
      'minPlayers': minPlayers,
      'durationMinutes': durationMinutes,
      'visibility': visibility,
      'joinPolicy': joinPolicy,
    };
  }

  factory ActivityFormData.fromJson(Map<String, dynamic> json) {
    return ActivityFormData(
      title: json['title'] as String? ?? '',
      sportType: json['sportType'] as String? ?? 'Basketball',
      coverImagePath: json['coverImagePath'] as String?,
      selectedDate: json['selectedDate'] != null
          ? DateTime.parse(json['selectedDate'] as String)
          : null,
      location: json['location'] as String? ?? '',
      venueAddress: json['venueAddress'] as String? ?? '',
      venueLatitude: (json['venueLatitude'] as num?)?.toDouble(),
      venueLongitude: (json['venueLongitude'] as num?)?.toDouble(),
      description: json['description'] as String? ?? '',
      maxParticipants: (json['maxParticipants'] as int?) ?? 10,
      skillLevel: json['skillLevel'] as String? ?? 'Intermediate',
      feeType: json['feeType'] as int? ?? 0,
      price: json['price'] as String?,
      priceMode: json['priceMode'] as int? ?? 0,
      minPlayers: json['minPlayers'] as int?,
      durationMinutes: json['durationMinutes'] as int? ?? 120,
      visibility: json['visibility'] as String? ?? 'Public',
      joinPolicy: json['joinPolicy'] as String? ?? 'open',
    );
  }
}

/// Provider for form data
final formDataProvider =
    StateNotifierProvider<FormDataNotifier, ActivityFormData>((ref) {
      return FormDataNotifier();
    });

class FormDataNotifier extends StateNotifier<ActivityFormData> {
  FormDataNotifier() : super(const ActivityFormData());

  void setTitle(String title) {
    state = state.copyWith(title: title);
  }

  void setSportType(String sportType) {
    state = state.copyWith(sportType: sportType);
  }

  void setCoverImage(String? path) {
    state = state.copyWith(coverImagePath: path);
  }

  void setSelectedDate(DateTime? date) {
    state = state.copyWith(selectedDate: date);
  }

  void setLocation(String location) {
    state = state.copyWith(location: location);
  }

  /// Records a picked venue: display name goes to the form fields.
  void setVenue({
    required String label,
    required String address,
    required double latitude,
    required double longitude,
  }) {
    state = state.copyWith(
      location: label,
      venueAddress: address,
      venueLatitude: latitude,
      venueLongitude: longitude,
    );
  }

  void setDescription(String description) {
    state = state.copyWith(description: description);
  }

  void setMaxParticipants(int participants) {
    final clamped = participants.clamp(2, 50);
    final min = state.minPlayers;
    // A minimum that no longer fits the new capacity collapses to full house instead of lingering as an invalid value.
    state = state.copyWith(
      maxParticipants: clamped,
      minPlayers: (min != null && min >= clamped) ? null : min,
    );
  }

  void setSkillLevel(String level) {
    state = state.copyWith(skillLevel: level);
  }

  void setFeeType(int type) {
    state = state.copyWith(feeType: type);
  }

  void setPrice(String? price) {
    state = state.copyWith(price: price);
  }

  void setPriceMode(int mode) {
    state = state.copyWith(priceMode: mode);
  }

  void setMinPlayers(int? min) {
    state = state.copyWith(minPlayers: min);
  }

  void setDurationMinutes(int minutes) {
    state = state.copyWith(durationMinutes: minutes);
  }

  void setVisibility(String visibility) {
    state = state.copyWith(visibility: visibility);
  }

  void setJoinPolicy(String joinPolicy) {
    state = state.copyWith(joinPolicy: joinPolicy);
  }

  void reset() {
    state = const ActivityFormData();
  }

  /// Read current form data (for auto-save) without exposing .state.
  ActivityFormData get current => state;

  /// Restore form from saved JSON (for draft resume).
  void loadFromJson(Map<String, dynamic> json) {
    state = ActivityFormData.fromJson(json);
  }
}

/// Tracks which fields have been "touched" (user interacted or Next was pressed).
final formDirtyFieldsProvider =
    StateNotifierProvider<FormDirtyNotifier, Set<String>>(
      (ref) => FormDirtyNotifier(),
    );

class FormDirtyNotifier extends StateNotifier<Set<String>> {
  FormDirtyNotifier() : super(const {});

  void markDirty(String field) {
    if (!state.contains(field)) {
      state = {...state, field};
    }
  }

  /// Mark all fields for the given step as dirty (called when Next is tapped).
  void markStepDirty(int step) {
    final fields = _stepFields(step);
    if (!state.containsAll(fields)) {
      state = {...state, ...fields};
    }
  }

  void reset() => state = const {};

  static List<String> _stepFields(int step) {
    switch (step) {
      case 1:
        return ['title'];
      case 2:
        return ['location', 'selectedDate', 'maxParticipants'];
      default:
        return [];
    }
  }
}

/// All validation errors regardless of dirty state.
final allFormErrorsProvider = Provider<Map<String, String>>((ref) {
  final formData = ref.watch(formDataProvider);
  return _validate(formData);
});

/// Validation errors **filtered to dirty fields only**. Widgets should watch this.
final formErrorsProvider = Provider<Map<String, String>>((ref) {
  final all = ref.watch(allFormErrorsProvider);
  final dirty = ref.watch(formDirtyFieldsProvider);
  return {
    for (final entry in all.entries)
      if (dirty.contains(entry.key)) entry.key: entry.value,
  };
});

Map<String, String> _validate(ActivityFormData data) {
  final errors = <String, String>{};

  if (data.title.trim().isEmpty) {
    errors['title'] = 'Please enter a title';
  }

  if (data.location.trim().isEmpty) {
    errors['location'] = 'Please enter a location';
  }

  if (data.selectedDate != null &&
      data.selectedDate!.isBefore(DateTime.now())) {
    errors['selectedDate'] = 'Date must be in the future';
  }

  if (data.maxParticipants < 2) {
    errors['maxParticipants'] = 'Minimum 2 participants required';
  }

  if (data.maxParticipants > 50) {
    errors['maxParticipants'] = 'Maximum 50 participants allowed';
  }

  if (data.feeType == 1 && (data.price == null || data.price!.trim().isEmpty)) {
    errors['price'] = 'Please enter a price';
  }

  if (data.feeType == 1 && data.priceMode == 1) {
    final min = data.minPlayers;
    if (min != null && (min < 2 || min > data.maxParticipants)) {
      errors['minPlayers'] = 'Min must be 2–${data.maxParticipants}';
    }
  }

  return errors;
}

/// Provider to check if the entire form is valid (used for final submit check).
final isFormValidProvider = Provider<bool>((ref) {
  final errors = ref.watch(allFormErrorsProvider);
  return errors.isEmpty;
});
