/// Domain model for a sports activity card displayed in the discovery feed.
class ActivityModel {
  final String id;
  final String title;
  final String sportType;
  final String description;

  /// Venue name — the primary location line (e.g. `Brooklyn Public Courts`).
  final String location;

  /// Street-level address shown beneath [location] on the detail screen.
  final String? addressLine;

  final double distanceKm;
  final DateTime dateTime;
  final String skillLevel;
  final int capacity;
  final int participantCount;
  final String hostName;
  final String? coverImageUrl;
  final ActivityStatus status;

  /// How long the activity runs, in minutes.
  final int durationMinutes;

  /// Whether joining costs money.
  final bool isPaid;

  /// Joining fee amount, set only when [isPaid] is true.
  /// Semantics depend on [feeMode]: `fixed` = price per person, `split` = worst-case price per person (`totalCost /.
  final double? fee;

  /// Pricing mode for paid games: `'fixed'` (flat price per person, the default) or `'split'` (total venue cost.
  final String feeMode;

  /// Total cost to split (venue booking etc.), set only for `split` mode.
  final double? totalCost;

  /// Minimum players the host needs for the game to run.
  final int? minPlayers;

  /// Host's average rating (0–5) for this activity's sport.
  final double? hostRating;
  final int hostGamesCount;

  /// Host-role average for this activity's sport, from `hostProfile.hostRatingBySport[sportType]`.
  final double? hostHostRating;
  final int hostHostRatingCount;

  /// Short atmosphere/expectation tags shown as small chips ("Friendly people", "Great vibes", "Arrive 15m early").
  final List<String> vibeTags;

  /// Backend viewer context (see `ActivityViewerContext` in the api server).
  final bool isParticipant;
  final bool isHost;
  final String? mySwipeDecision;

  /// Backend host uid (`ActivityRecord.hostId`).
  final String hostId;

  /// Raw venue coordinates from the backend.
  final double? latitude;
  final double? longitude;

  /// How new members get in (`ActivityRecord.joinPolicy`): `'open'` means instant join, `'approval'` parks the user.
  final String joinPolicy;

  /// The viewer's join-request state on approval-gated activities (`'none'`, `'pending'`, `'approved'`, `'declined'`).
  final String? joinRequestStatus;

  /// Denormalized count of pending join requests (`ActivityRecord.pendingRequestCount`).
  final int pendingRequestCount;

  /// Raw backend lifecycle string (`open` / `full` / `cancelled` / `completed` / `removed`).
  final String lifecycleStatus;

  /// Weather snapshot captured at creation (Open-Meteo, best-effort).
  final double? weatherTemp;
  final int? weatherCode;
  final String? weatherDesc;
  final int? weatherRain;

  const ActivityModel({
    required this.id,
    required this.title,
    required this.sportType,
    required this.description,
    required this.location,
    this.addressLine,
    required this.distanceKm,
    required this.dateTime,
    required this.skillLevel,
    required this.capacity,
    required this.participantCount,
    required this.hostName,
    this.coverImageUrl,
    this.status = ActivityStatus.available,
    this.durationMinutes = 120,
    this.isPaid = false,
    this.fee,
    this.feeMode = 'fixed',
    this.totalCost,
    this.minPlayers,
    this.hostRating,
    this.hostGamesCount = 0,
    this.hostHostRating,
    this.hostHostRatingCount = 0,
    this.vibeTags = const ['Friendly people', 'Great vibes'],
    this.isParticipant = false,
    this.isHost = false,
    this.mySwipeDecision,
    this.hostId = '',
    this.latitude,
    this.longitude,
    this.joinPolicy = 'open',
    this.joinRequestStatus,
    this.pendingRequestCount = 0,
    this.lifecycleStatus = '',
    this.weatherTemp,
    this.weatherCode,
    this.weatherDesc,
    this.weatherRain,
  });

  /// The activity's end time, derived from [dateTime] + [durationMinutes].
  DateTime get endTime => dateTime.add(Duration(minutes: durationMinutes));

  /// Compact duration label for the discovery card meta row.
  String get durationLabel {
    if (durationMinutes % 60 == 0) return '~${durationMinutes ~/ 60}h';
    if (durationMinutes > 60) {
      return '~${(durationMinutes / 60).toStringAsFixed(1)}h';
    }
    return '~${durationMinutes}m';
  }

  /// True when the game splits a total cost instead of charging a flat per-person price.
  bool get isSplitCost => isPaid && feeMode == 'split';

  /// Per-person price the joiner sees.
  double? get displayFee {
    if (!isPaid) return null;
    if (!isSplitCost) return fee;
    if (totalCost == null) return fee;
    final divisor = (minPlayers ?? capacity).clamp(1, 1000);
    return totalCost! / divisor;
  }

  /// Short price label for detail rows.
  String? get feeLabel {
    final amount = displayFee;
    if (amount == null) return null;
    final formatted = '\$${amount.toStringAsFixed(2)} /person';
    return isSplitCost ? '≈$formatted · split' : formatted;
  }

  /// One-line split explainer for detail screens.
  String? get splitExplainer {
    if (!isSplitCost || totalCost == null) return null;
    final min = minPlayers ?? capacity;
    final worst = displayFee;
    final total =
        '\$${totalCost!.toStringAsFixed(totalCost! == totalCost!.roundToDouble() ? 0 : 2)}';
    final each = worst != null ? '\$${worst.toStringAsFixed(2)}' : '—';
    return 'Total $total · min $min · max $each each, cheaper when full';
  }

  ActivityModel copyWith({
    String? title,
    String? sportType,
    String? description,
    String? location,
    String? addressLine,
    double? distanceKm,
    DateTime? dateTime,
    String? skillLevel,
    int? capacity,
    String? hostName,
    String? coverImageUrl,
    int? durationMinutes,
    bool? isPaid,
    double? hostRating,
    int? hostGamesCount,
    double? hostHostRating,
    int? hostHostRatingCount,
    List<String>? vibeTags,
    String? lifecycleStatus,
    ActivityStatus? status,
    int? participantCount,
    bool? isParticipant,
    bool? isHost,
    String? mySwipeDecision,
    String? hostId,
    double? latitude,
    double? longitude,
    String? joinPolicy,
    String? joinRequestStatus,
    double? fee,
    String? feeMode,
    double? totalCost,
    int? minPlayers,
    int? pendingRequestCount,
    double? weatherTemp,
    int? weatherCode,
    String? weatherDesc,
    int? weatherRain,
  }) {
    return ActivityModel(
      id: id,
      title: title ?? this.title,
      sportType: sportType ?? this.sportType,
      description: description ?? this.description,
      location: location ?? this.location,
      addressLine: addressLine ?? this.addressLine,
      distanceKm: distanceKm ?? this.distanceKm,
      dateTime: dateTime ?? this.dateTime,
      skillLevel: skillLevel ?? this.skillLevel,
      capacity: capacity ?? this.capacity,
      participantCount: participantCount ?? this.participantCount,
      hostName: hostName ?? this.hostName,
      coverImageUrl: coverImageUrl ?? this.coverImageUrl,
      status: status ?? this.status,
      durationMinutes: durationMinutes ?? this.durationMinutes,
      isPaid: isPaid ?? this.isPaid,
      fee: fee ?? this.fee,
      feeMode: feeMode ?? this.feeMode,
      totalCost: totalCost ?? this.totalCost,
      minPlayers: minPlayers ?? this.minPlayers,
      hostRating: hostRating ?? this.hostRating,
      hostGamesCount: hostGamesCount ?? this.hostGamesCount,
      hostHostRating: hostHostRating ?? this.hostHostRating,
      hostHostRatingCount: hostHostRatingCount ?? this.hostHostRatingCount,
      vibeTags: vibeTags ?? this.vibeTags,
      isParticipant: isParticipant ?? this.isParticipant,
      isHost: isHost ?? this.isHost,
      mySwipeDecision: mySwipeDecision ?? this.mySwipeDecision,
      hostId: hostId ?? this.hostId,
      latitude: latitude ?? this.latitude,
      longitude: longitude ?? this.longitude,
      joinPolicy: joinPolicy ?? this.joinPolicy,
      joinRequestStatus: joinRequestStatus ?? this.joinRequestStatus,
      pendingRequestCount: pendingRequestCount ?? this.pendingRequestCount,
      lifecycleStatus: lifecycleStatus ?? this.lifecycleStatus,
      weatherTemp: weatherTemp ?? this.weatherTemp,
      weatherCode: weatherCode ?? this.weatherCode,
      weatherDesc: weatherDesc ?? this.weatherDesc,
      weatherRain: weatherRain ?? this.weatherRain,
    );
  }

  bool get isFull => capacity > 0 && participantCount >= capacity;
  bool get isAlmostFull => participantCount >= (capacity * 0.8).ceil();

  int get spotsLeft => (capacity - participantCount).clamp(0, capacity);

  /// True when newcomers must be approved by the host instead of joining instantly.
  bool get requiresApproval => joinPolicy == 'approval';

  /// True once the start time has passed.
  bool get hasStarted => !dateTime.isAfter(DateTime.now());

  /// True when this activity's chat is read-only archived.
  bool get isChatArchived {
    if (status == ActivityStatus.past) {
      final threshold = DateTime.now().subtract(const Duration(days: 7));
      return endTime.isBefore(threshold);
    }
    return false;
  }

  /// True when the viewer already has a pending request on an approval-gated activity.
  bool get hasPendingRequest => joinRequestStatus == 'pending';

  /// True when a weather snapshot was saved at creation.
  bool get hasWeatherSnapshot =>
      weatherTemp != null ||
      weatherCode != null ||
      weatherDesc != null ||
      weatherRain != null;

  /// Serialises to the API wire format (snake_case).
  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'title': title,
      'sport_type': sportType,
      'description': description,
      'location': location,
      'address_line': addressLine,
      'distance_km': distanceKm,
      'date_time': dateTime.toIso8601String(),
      'skill_level': skillLevel,
      'capacity': capacity,
      'participant_count': participantCount,
      'host_name': hostName,
      'cover_image_url': coverImageUrl,
      'status': status.name,
      'duration_minutes': durationMinutes,
      'is_paid': isPaid,
      'fee': fee,
      'fee_mode': feeMode,
      'total_cost': totalCost,
      'min_players': minPlayers,
      'host_rating': hostRating,
      'host_games_count': hostGamesCount,
      'host_host_rating': hostHostRating,
      'host_host_rating_count': hostHostRatingCount,
      'vibe_tags': vibeTags,
      'is_participant': isParticipant,
      'is_host': isHost,
      'my_swipe_decision': mySwipeDecision,
      'host_id': hostId,
      'latitude': latitude,
      'longitude': longitude,
      'join_policy': joinPolicy,
      'join_request_status': joinRequestStatus,
      'pending_request_count': pendingRequestCount,
      'weather_temp': weatherTemp,
      'weather_code': weatherCode,
      'weather_desc': weatherDesc,
      'weather_rain': weatherRain,
    };
  }

  /// Deserialises from an API response map.
  /// Accepts **both** the snake_case format used by the mobile app's own.
  /// If `startTime` and `endTime` are both present, [durationMinutes] is computed from their difference.
  /// All [RemoteActivityRepository] methods call this instead of maintaining their own private `_parse`.
  factory ActivityModel.fromJson(Map<String, dynamic> json) {
    final startRaw =
        json['startTime'] as String? ?? json['date_time'] as String?;
    final endRaw = json['endTime'] as String? ?? json['end_time'] as String?;

    // Backend sends UTC ISO (`Z`); convert to device-local ONCE here so every downstream formatter renders correct.
    final start =
        DateTime.tryParse(startRaw ?? '')?.toLocal() ?? DateTime(2100);
    final end = endRaw == null ? null : DateTime.tryParse(endRaw)?.toLocal();

    int resolvedDuration;
    if (end != null && end.isAfter(start)) {
      resolvedDuration = end.difference(start).inMinutes;
    } else {
      resolvedDuration =
          (json['duration_minutes'] as num?)?.toInt() ??
          (json['durationMinutes'] as num?)?.toInt() ??
          120;
    }

    // Backend returns host info under a nested `hostProfile` object.
    final hostProfile = json['hostProfile'] as Map<String, dynamic>?;
    final hostName =
        hostProfile?['displayName'] as String? ??
        json['host_name'] as String? ??
        json['hostName'] as String? ??
        '';

    // Viewer context straight from the backend (`ActivityViewerContext`).
    final latitude = (json['latitude'] as num?)?.toDouble();
    final longitude = (json['longitude'] as num?)?.toDouble();
    final isHost = json['isHost'] as bool? ?? json['is_host'] as bool? ?? false;
    final isParticipant =
        json['isParticipant'] as bool? ??
        json['is_participant'] as bool? ??
        false;
    final mySwipeDecision =
        json['mySwipeDecision'] as String? ??
        json['my_swipe_decision'] as String?;

    // Backend lifecycle states (`open`/`full`/`cancelled`/`completed`/ `removed`) map onto the mobile enum.
    final rawLifecycle = json['status']?.toString() ?? '';
    final sport =
        json['sportType'] as String? ?? json['sport_type'] as String? ?? '';
    var status = _statusFromString(json['status'] as String?);
    if (isHost) {
      status = ActivityStatus.hosted;
    } else if (isParticipant) {
      status = ActivityStatus.joined;
    }

    return ActivityModel(
      id: json['id']?.toString() ?? json['activityId']?.toString() ?? '',
      title: json['title'] as String? ?? '',
      sportType: sport,
      description: json['description'] as String? ?? '',
      location:
          json['locationName'] as String? ?? json['location'] as String? ?? '',
      addressLine:
          json['address'] as String? ?? json['address_line'] as String?,
      distanceKm: (json['distance_km'] as num?)?.toDouble() ?? 0.0,
      dateTime: start,
      skillLevel:
          json['skillLevel'] as String? ?? json['skill_level'] as String? ?? '',
      capacity: (json['capacity'] as num?)?.toInt() ?? 10,
      participantCount:
          (json['participantCount'] as num?)?.toInt() ??
          (json['participant_count'] as num?)?.toInt() ??
          0,
      hostName: hostName,
      coverImageUrl:
          json['coverImageUrl'] as String? ??
          json['cover_image_url'] as String?,
      status: status,
      durationMinutes: resolvedDuration,
      isPaid: json['is_paid'] as bool? ?? json['isPaid'] as bool? ?? false,
      fee: (json['fee'] as num?)?.toDouble(),
      feeMode: _feeModeFromString(
        json['fee_mode'] as String? ?? json['feeMode'] as String?,
      ),
      totalCost:
          (json['total_cost'] as num?)?.toDouble() ??
          (json['totalCost'] as num?)?.toDouble(),
      minPlayers:
          (json['min_players'] as num?)?.toInt() ??
          (json['minPlayers'] as num?)?.toInt(),
      hostRating: _hostRatingFor(json, sport),
      hostGamesCount: _hostGamesFor(json),
      hostHostRating: _hostHostRatingFor(json, sport),
      hostHostRatingCount: _hostHostRatingCountFor(json, sport),
      vibeTags:
          (json['vibe_tags'] as List?)?.map((e) => e.toString()).toList() ??
          const [],
      isParticipant: isParticipant,
      isHost: isHost,
      mySwipeDecision: mySwipeDecision,
      hostId: json['hostId']?.toString() ?? json['host_id']?.toString() ?? '',
      latitude: latitude,
      longitude: longitude,
      joinPolicy:
          json['joinPolicy'] as String? ??
          json['join_policy'] as String? ??
          'open',
      joinRequestStatus:
          json['joinRequestStatus'] as String? ??
          json['join_request_status'] as String?,
      pendingRequestCount:
          (json['pendingRequestCount'] as num?)?.toInt() ??
          (json['pending_request_count'] as num?)?.toInt() ??
          0,
      lifecycleStatus: rawLifecycle,
      weatherTemp:
          (json['weatherTemp'] as num?)?.toDouble() ??
          (json['weather_temp'] as num?)?.toDouble(),
      weatherCode:
          (json['weatherCode'] as num?)?.toInt() ??
          (json['weather_code'] as num?)?.toInt(),
      weatherDesc:
          json['weatherDesc'] as String? ?? json['weather_desc'] as String?,
      weatherRain:
          (json['weatherRain'] as num?)?.toInt() ??
          (json['weather_rain'] as num?)?.toInt(),
    );
  }

  static String _feeModeFromString(String? s) => switch (s) {
    'split' => 'split',
    _ => 'fixed',
  };

  /// Real host rating for [sport] from `hostProfile.ratingBySport`.
  static double? _hostRatingFor(Map<String, dynamic> json, String sport) {
    final profile = json['hostProfile'];
    final buckets = profile is Map<String, dynamic>
        ? profile['ratingBySport']
        : null;
    final bucket = buckets is Map<String, dynamic> && sport.isNotEmpty
        ? buckets[sport]
        : null;
    if (bucket is Map<String, dynamic>) {
      final count = (bucket['count'] as num?)?.toInt() ?? 0;
      if (count > 0) {
        final avg = (bucket['average'] as num?)?.toDouble();
        if (avg != null) return avg;
      }
    }
    return (json['host_rating'] as num?)?.toDouble() ??
        (json['hostRating'] as num?)?.toDouble();
  }

  /// Host-role rating bucket for [sport] from `hostProfile.hostRatingBySport` (`{average, count}`, maintained on every.
  static Map<String, dynamic>? _hostBucketFor(
    Map<String, dynamic> json,
    String sport,
  ) {
    final profile = json['hostProfile'];
    final buckets = profile is Map<String, dynamic>
        ? profile['hostRatingBySport'] ?? profile['host_rating_by_sport']
        : null;
    if (buckets is Map<String, dynamic> && sport.isNotEmpty) {
      final bucket = buckets[sport];
      if (bucket is Map<String, dynamic>) return bucket;
      if (bucket is Map) return Map<String, dynamic>.from(bucket);
    }
    return null;
  }

  /// Host-role average for [sport].
  static double? _hostHostRatingFor(Map<String, dynamic> json, String sport) {
    final bucket = _hostBucketFor(json, sport);
    if (bucket != null) {
      final count = (bucket['count'] as num?)?.toInt() ?? 0;
      if (count > 0) {
        final avg = (bucket['average'] as num?)?.toDouble();
        if (avg != null) return avg;
      }
    }
    return (json['host_host_rating'] as num?)?.toDouble() ??
        (json['hostHostRating'] as num?)?.toDouble();
  }

  /// Host-role rating count for [sport].
  static int _hostHostRatingCountFor(Map<String, dynamic> json, String sport) {
    final bucket = _hostBucketFor(json, sport);
    if (bucket != null) {
      return (bucket['count'] as num?)?.toInt() ?? 0;
    }
    return (json['host_host_rating_count'] as num?)?.toInt() ??
        (json['hostHostRatingCount'] as num?)?.toInt() ??
        0;
  }

  /// Real hosted-games count from `hostProfile.hostedCount`.
  static int _hostGamesFor(Map<String, dynamic> json) {
    final profile = json['hostProfile'];
    final counts = profile is Map<String, dynamic>
        ? ((profile['hostedCount'] as num?)?.toInt() ??
              (profile['activitiesCount'] as num?)?.toInt())
        : null;
    return counts ??
        (json['host_games_count'] as num?)?.toInt() ??
        (json['hostGamesCount'] as num?)?.toInt() ??
        0;
  }

  static ActivityStatus _statusFromString(String? s) => switch (s) {
    'available' => ActivityStatus.available,
    'almostFull' || 'almost_full' => ActivityStatus.almostFull,
    'open' => ActivityStatus.available,
    'full' => ActivityStatus.full,
    'joined' => ActivityStatus.joined,
    'hosted' => ActivityStatus.hosted,
    'past' || 'cancelled' || 'completed' || 'removed' => ActivityStatus.past,
    _ => ActivityStatus.available,
  };
}

enum ActivityStatus { available, almostFull, full, joined, hosted, past }
