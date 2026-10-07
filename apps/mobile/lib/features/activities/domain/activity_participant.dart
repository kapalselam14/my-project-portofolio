/// Domain model for a participant entry shown on the Activity Participants screen.
class ActivityParticipant {
  const ActivityParticipant({
    required this.userId,
    required this.name,
    this.avatarAsset,
    required this.skillLevel,
    required this.joinedAt,
    required this.isOrganizer,
    this.isCheckedIn = false,
    this.avatarUrl,
  });

  final String userId;
  final String name;

  /// Bundled asset filename.
  final String? avatarAsset;
  final String skillLevel;
  final DateTime joinedAt;
  final bool isOrganizer;

  /// Whether the host has recorded this participant as checked in at the venue.
  final bool isCheckedIn;

  /// Remote photo URL from the backend profile (`photoUrl`), if the user uploaded one.
  final String? avatarUrl;
}
