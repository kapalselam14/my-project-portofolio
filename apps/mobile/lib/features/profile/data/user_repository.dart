import '../domain/user_model.dart';

/// The backend explicitly rejected a profile update.
/// Only thrown when a response was actually received.
class ProfileUpdateException implements Exception {
  ProfileUpdateException(this.message);
  final String message;

  @override
  String toString() => 'ProfileUpdateException: $message';
}

/// Maximum profile-photo file size accepted (5 MB — mirrors `isAllowedProfileImage` in storage.rules).
const kMaxAvatarBytes = 5 * 1024 * 1024;

/// Thrown when the picked profile photo exceeds [kMaxAvatarBytes].
class AvatarTooLargeException implements Exception {
  AvatarTooLargeException([this.maxBytes = kMaxAvatarBytes]);
  final int maxBytes;

  String get message {
    final mb = maxBytes ~/ (1024 * 1024);
    return 'Cannot upload image more than ${mb}MB';
  }

  @override
  String toString() => 'AvatarTooLargeException: $message';
}

abstract class UserRepository {
  Future<UserModel> me();
  Future<UserModel?> byId(String id);

  /// Uploads a new profile photo from [localPath].
  Future<UserModel> uploadAvatar({required String localPath});
  Future<UserModel> updateProfile({
    String? displayName,
    String? bio,
    String? location,
    String? email,
    String? phone,
    DateTime? dateOfBirth,
    int? heightCm,
    int? weightKg,
    String? goal,
    List<({String sport, String level})>? sports,
    String? joinReason,
  });
}
