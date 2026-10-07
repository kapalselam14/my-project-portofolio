import 'dart:io';

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_storage/firebase_storage.dart';
import 'package:flutter/foundation.dart';

/// Server-side size caps (mirrors `storage.rules` — keep in sync):
/// profile photos 5 MB, activity covers and chat attachments 8 MB.
/// Client-side pre-checks against these caps let the UI name the reason
/// ("too large") instead of surfacing a generic upload failure after
/// burning the upload bandwidth.
const kMaxChatImageBytes = 8 * 1024 * 1024;
const kMaxCoverImageBytes = 8 * 1024 * 1024;
const kMaxEvidenceBytes = 8 * 1024 * 1024;

/// Thrown by [StorageService.checkImageSize] when the picked file exceeds
/// the destination's cap. Callers must let this reach the screen verbatim
/// (it carries the user-facing copy) — never swallow it into a generic
/// failure or, worse, silently proceed without the photo.
class ImageTooLargeException implements Exception {
  ImageTooLargeException(this.maxBytes, [this.actualBytes]);

  final int maxBytes;
  final int? actualBytes;

  static String _mb(int bytes) => (bytes / (1024 * 1024)).toStringAsFixed(1);

  String get message {
    final actual = actualBytes != null ? ' (${_mb(actualBytes!)} MB)' : '';
    return 'Photo is too large$actual. Maximum is ${_mb(maxBytes)} MB — pick a smaller one.';
  }

  @override
  String toString() => 'ImageTooLargeException: $message';
}

/// Thin wrapper around Firebase Storage for the two image-upload
/// flows the app actually has: activity cover photos and chat
/// attachments.
///
/// Wraps every Firebase call in a `Firebase.apps.isEmpty` guard so
/// the service degrades gracefully when the project is unconfigured
/// (no `firebase_options.dart` / platform config files). In that
/// case [uploadImage] returns `null` so the caller can either:
///   * skip the upload and proceed with the rest of the flow
///     (e.g. create an activity with no cover)
///   * surface a user-facing "image upload unavailable" error
///
/// Files are uploaded to the caller-provided [storagePath]. Two flows:
///   * chat attachments → [uploadChatAttachment]
///     (`uploads/chat-attachments/{scope}/{uid}/…`, owner-only per
///     Storage rules; M2 fix — previously any signed-in user could
///     delete anyone's attachment).
///   * activity covers → `activities/{id}/cover/…` via [uploadToPath]
///     (host-only per Storage rules). NOTE: plain [uploadImage] to
///     `uploads/activity-covers/…` is NOT allow-listed by storage.rules
///     and will be denied — covers must use the two-phase
///     create-then-[uploadToPath]+`PATCH cover` flow.
class StorageService {
  StorageService._();

  static final StorageService instance = StorageService._();

  /// Client-side size gate: throws [ImageTooLargeException] when the
  /// file at [localPath] exceeds [maxBytes], so the UI can alert with
  /// the reason instead of uploading megabytes just to be denied by
  /// `storage.rules`. Unreadable/missing files are ignored here — the
  /// upload attempt below fails generically as before.
  static Future<void> checkImageSize(String localPath, int maxBytes) async {
    try {
      final size = await File(localPath).length();
      if (size > maxBytes) throw ImageTooLargeException(maxBytes, size);
    } on ImageTooLargeException {
      rethrow;
    } catch (_) {
      // Ignore stat errors — handled by the upload below.
    }
  }

  /// Uploads [localPath] to Firebase Storage and returns the
  /// public download URL. Returns `null` if Firebase isn't
  /// configured or the upload fails.
  ///
  /// [folder] is a logical bucket name (e.g. `'activity-covers'` or
  /// `'chat-attachments'`); it scopes the storage rules without
  /// leaking the underlying bucket structure to the caller.
  Future<String?> uploadImage({
    required String localPath,
    required String folder,
  }) async {
    final basename = localPath.split('/').last;
    final timestamp = DateTime.now().millisecondsSinceEpoch;
    return _put(
      localPath: localPath,
      storagePath: 'uploads/$folder/$timestamp-$basename',
    );
  }

  /// Uploads a chat photo attachment and returns the public download
  /// URL (`null` on any failure — same contract as [uploadImage]).
  ///
  /// M2 fix: the uploader's uid is embedded in the path
  /// (`uploads/chat-attachments/{scope}/{uid}/{timestamp}-{basename}`)
  /// so Storage rules can restrict write/delete to the owner.
  /// [scope] is the activity id (group chat) or `dm_{threadId}` (DM);
  /// both are sanitised to path-safe characters. An empty [uid] throws
  /// [StateError] — unattributed uploads must never silently fall back
  /// to a world-writable path.
  Future<String?> uploadChatAttachment({
    required String localPath,
    required String scope,
    required String uid,
  }) async {
    final owner = uid.trim();
    if (owner.isEmpty) {
      throw StateError('uploadChatAttachment requires a non-empty uid');
    }
    final safeScope = scope.replaceAll(RegExp(r'[^a-zA-Z0-9_-]'), '_');
    final safeOwner = owner.replaceAll(RegExp(r'[^a-zA-Z0-9_-]'), '_');
    final basename = localPath.split('/').last;
    final timestamp = DateTime.now().millisecondsSinceEpoch;
    return _put(
      localPath: localPath,
      storagePath:
          'uploads/chat-attachments/$safeScope/$safeOwner/$timestamp-$basename',
    );
  }

  /// Uploads a report-evidence photo and returns the public download URL
  /// (`null` on any failure — same contract as [uploadImage]).
  ///
  /// Owner-scoped like [uploadChatAttachment]
  /// (`uploads/report-evidence/{uid}/{timestamp}-{basename}`) since the
  /// report this evidence attaches to doesn't exist yet at upload time —
  /// only the uploader's uid is known. An empty [uid] throws [StateError].
  ///
  /// Unlike the other upload methods, this one streams real progress via
  /// [onProgress] (`bytesTransferred / totalBytes`, 0.0–1.0) instead of
  /// going through [_put], which awaits the whole upload with no progress
  /// visibility. Kept as its own method so [_put]'s existing callers are
  /// untouched.
  Future<String?> uploadReportEvidence({
    required String localPath,
    required String uid,
    void Function(double progress)? onProgress,
  }) async {
    final owner = uid.trim();
    if (owner.isEmpty) {
      throw StateError('uploadReportEvidence requires a non-empty uid');
    }
    if (!_isFirebaseReady()) {
      debugPrint('[StorageService] Firebase not initialised — skipping upload');
      return null;
    }

    try {
      final file = File(localPath);
      if (!await file.exists()) {
        debugPrint('[StorageService] File not found: $localPath');
        return null;
      }

      final safeOwner = owner.replaceAll(RegExp(r'[^a-zA-Z0-9_-]'), '_');
      final basename = localPath.split('/').last;
      final timestamp = DateTime.now().millisecondsSinceEpoch;
      final storagePath =
          'uploads/report-evidence/$safeOwner/$timestamp-$basename';
      final ref = FirebaseStorage.instance.ref(storagePath);

      final task = ref.putFile(
        file,
        SettableMetadata(contentType: _guessContentType(basename)),
      );
      if (onProgress != null) {
        task.snapshotEvents.listen((snapshot) {
          if (snapshot.totalBytes > 0) {
            onProgress(snapshot.bytesTransferred / snapshot.totalBytes);
          }
        });
      }
      final snapshot = await task;

      if (snapshot.state != TaskState.success) {
        debugPrint('[StorageService] Upload state: ${snapshot.state}');
        return null;
      }

      return await ref.getDownloadURL();
    } catch (e, st) {
      debugPrint('[StorageService.uploadReportEvidence] $e\n$st');
      return null;
    }
  }

  /// Uploads [localPath] to an explicit Storage [storagePath] (no
  /// `uploads/` prefix) and returns both the path and its download
  /// URL. Used for flows where the backend validates path ownership
  /// (`PATCH /users/me/photo` requires `users/{uid}/profile/…`,
  /// activity covers require `activities/{id}/cover/…`).
  Future<({String path, String downloadUrl})?> uploadToPath({
    required String localPath,
    required String storagePath,
  }) async {
    final downloadUrl = await _put(
      localPath: localPath,
      storagePath: storagePath,
    );
    if (downloadUrl == null) return null;
    return (path: storagePath, downloadUrl: downloadUrl);
  }

  Future<String?> _put({
    required String localPath,
    required String storagePath,
  }) async {
    if (!_isFirebaseReady()) {
      debugPrint('[StorageService] Firebase not initialised — skipping upload');
      return null;
    }

    try {
      final file = File(localPath);
      if (!await file.exists()) {
        debugPrint('[StorageService] File not found: $localPath');
        return null;
      }

      final basename = localPath.split('/').last;
      final ref = FirebaseStorage.instance.ref(storagePath);

      final uploadTask = await ref.putFile(
        file,
        SettableMetadata(contentType: _guessContentType(basename)),
      );

      if (uploadTask.state != TaskState.success) {
        debugPrint('[StorageService] Upload state: ${uploadTask.state}');
        return null;
      }

      return await ref.getDownloadURL();
    } catch (e, st) {
      debugPrint('[StorageService._put] $e\n$st');
      return null;
    }
  }

  /// True if Firebase has been initialised (i.e. the platform config
  /// files are present and `Firebase.initializeApp()` succeeded at
  /// app start). When false, every call to [uploadImage] returns
  /// `null`.
  bool _isFirebaseReady() {
    try {
      return Firebase.apps.isNotEmpty;
    } catch (_) {
      return false;
    }
  }

  /// Sniffs the file extension for a MIME type so the downloaded
  /// file opens with the right app on the receiving end. Falls back
  /// to `image/jpeg` for unknown extensions — `image_picker` always
  /// produces a JPEG/PNG so this is a safe default.
  String _guessContentType(String basename) {
    final ext = basename.split('.').last.toLowerCase();
    switch (ext) {
      case 'png':
        return 'image/png';
      case 'gif':
        return 'image/gif';
      case 'webp':
        return 'image/webp';
      case 'heic':
        return 'image/heic';
      case 'jpg':
      case 'jpeg':
      default:
        return 'image/jpeg';
    }
  }
}
