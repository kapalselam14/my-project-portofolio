import '../../ratings/domain/rating_models.dart';

/// Domain model representing an app user (host, participant, chat sender).
class UserModel {
  final String id;
  final String displayName;
  final String? avatarAsset;
  final String? avatarUrl;

  /// Legacy single-score rating used by the pre-rating-system profile stat card.
  final double? rating;
  final String? bio;
  final String? location;

  /// Total activities this user has participated in.
  final int activitiesCount;

  /// Total activities this user has hosted.
  final int hostedCount;

  /// Sports + skill level pairs (e.g. `[('Basketball', 'Intermediate')]`).
  final List<({String sport, String level})> sports;

  /// General playing level (`beginner`/`intermediate`/`advanced`/`any`) from the user record.
  final String? skillLevel;

  /// Per-sport community rating aggregate.
  /// Empty when the user has fewer than one completed-activity rating.
  final Map<String, SportRatingSummary> ratingBySport;

  /// Cumulative count across every sport — surfaced in profile screens as a single "(N ratings)" chip.
  final int totalRatingCount;

  /// Host-role rating aggregates (stars received while hosting), keyed by sport.
  final Map<String, SportRatingSummary> hostRatingBySport;

  /// Cumulative host-role count across sports.
  final int totalHostRatingCount;

  // Fields editable from Edit Profile (PRD Section 2.3).
  // These used to be string literals hardcoded in the screen's `_initFields`.
  final String? email;
  final String? phone;
  final DateTime? dateOfBirth;
  final int? heightCm;
  final int? weightKg;
  final String? goal;

  const UserModel({
    required this.id,
    required this.displayName,
    this.avatarAsset,
    this.avatarUrl,
    this.rating,
    this.bio,
    this.location,
    this.activitiesCount = 0,
    this.hostedCount = 0,
    this.sports = const [],
    this.skillLevel,
    this.ratingBySport = const {},
    this.totalRatingCount = 0,
    this.hostRatingBySport = const {},
    this.totalHostRatingCount = 0,
    this.email,
    this.phone,
    this.dateOfBirth,
    this.heightCm,
    this.weightKg,
    this.goal,
  });

  UserModel copyWith({
    String? id,
    String? displayName,
    String? avatarAsset,
    String? avatarUrl,
    double? rating,
    String? bio,
    String? location,
    int? activitiesCount,
    int? hostedCount,
    String? email,
    String? phone,
    DateTime? dateOfBirth,
    int? heightCm,
    int? weightKg,
    String? goal,
    List<({String sport, String level})>? sports,
    String? skillLevel,
    Map<String, SportRatingSummary>? ratingBySport,
    int? totalRatingCount,
    Map<String, SportRatingSummary>? hostRatingBySport,
    int? totalHostRatingCount,
  }) {
    return UserModel(
      id: id ?? this.id,
      displayName: displayName ?? this.displayName,
      avatarAsset: avatarAsset ?? this.avatarAsset,
      avatarUrl: avatarUrl ?? this.avatarUrl,
      rating: rating ?? this.rating,
      bio: bio ?? this.bio,
      location: location ?? this.location,
      activitiesCount: activitiesCount ?? this.activitiesCount,
      hostedCount: hostedCount ?? this.hostedCount,
      sports: sports ?? this.sports,
      skillLevel: skillLevel ?? this.skillLevel,
      ratingBySport: ratingBySport ?? this.ratingBySport,
      totalRatingCount: totalRatingCount ?? this.totalRatingCount,
      hostRatingBySport: hostRatingBySport ?? this.hostRatingBySport,
      totalHostRatingCount: totalHostRatingCount ?? this.totalHostRatingCount,
      email: email ?? this.email,
      phone: phone ?? this.phone,
      dateOfBirth: dateOfBirth ?? this.dateOfBirth,
      heightCm: heightCm ?? this.heightCm,
      weightKg: weightKg ?? this.weightKg,
      goal: goal ?? this.goal,
    );
  }

  /// Whole years since [dateOfBirth]. Screens show this ("24") — never the raw birthdate.
  int? get age {
    final dob = dateOfBirth;
    if (dob == null) return null;
    final now = DateTime.now();
    var years = now.year - dob.year;
    if (now.month < dob.month ||
        (now.month == dob.month && now.day < dob.day)) {
      years--;
    }
    return years < 0 ? null : years;
  }

  /// Returns the rating summary for a given sport, falling back to the legacy.
  SportRatingSummary? ratingFor(String sportType) {
    final keyed = ratingBySport[sportType];
    if (keyed != null && keyed.hasRatings) return keyed;
    if (rating != null && rating! > 0 && totalRatingCount > 0) {
      return SportRatingSummary(average: rating!, count: totalRatingCount);
    }
    return null;
  }

  /// Host-role summary for a sport.
  SportRatingSummary? hostRatingFor(String sportType) {
    final keyed = hostRatingBySport[sportType];
    if (keyed != null && keyed.hasRatings) return keyed;
    return null;
  }

  /// Blended host average across sports (count-weighted). Null when none.
  SportRatingSummary? get overallHostRating {
    var sum = 0.0;
    var count = 0;
    for (final s in hostRatingBySport.values) {
      sum += s.average * s.count;
      count += s.count;
    }
    if (count <= 0) return null;
    return SportRatingSummary(average: sum / count, count: count);
  }
}
