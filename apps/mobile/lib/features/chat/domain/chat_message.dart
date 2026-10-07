/// Domain model for a single chat message inside an activity group chat.
/// A message is plain text by default.
/// The backend stores text-only messages, so a photo travels as its download URL inside [text].
class ChatMessage {
  final String id;
  final String senderId;
  final String senderName;
  final String? senderAvatarAsset;

  /// Remote photo URL of the sender (`photoUrl` on their profile), if known.
  final String? senderAvatarUrl;
  final String text;
  final DateTime sentAt;
  final bool isMine;

  /// Local file path of an attached photo, when this message is a photo upload rather than plain text.
  final String? imagePath;

  /// Remote download URL of an attached photo.
  final String? imageUrl;

  /// Coordinates of a shared location, when this message is a location share rather than plain text.
  final double? latitude;
  final double? longitude;

  /// Wire `type` of the message (`'text'` default, `'system'` for server-posted events like "Sam left the group").
  final String messageType;

  const ChatMessage({
    required this.id,
    required this.senderId,
    required this.senderName,
    required this.text,
    required this.sentAt,
    this.senderAvatarAsset,
    this.senderAvatarUrl,
    this.isMine = false,
    this.imagePath,
    this.imageUrl,
    this.latitude,
    this.longitude,
    this.messageType = 'text',
  });

  bool get isImage => imagePath != null || imageUrl != null;
  bool get isLocation => latitude != null && longitude != null;
  bool get isSystem => messageType == 'system';

  /// Returns [text] when it is exactly one image URL, `null` otherwise.
  /// Recognises direct image links (http(s) URL ending in a known image extension) and Firebase / Google Cloud Storage.
  static String? imageUrlFromText(String text) {
    final trimmed = text.trim();
    if (trimmed.isEmpty || trimmed.contains(RegExp(r'\s'))) return null;
    final uri = Uri.tryParse(trimmed);
    if (uri == null || !uri.hasScheme) return null;
    if (uri.scheme != 'http' && uri.scheme != 'https') return null;
    final host = uri.host.toLowerCase();
    if (host.contains('firebasestorage.googleapis.com') ||
        host.contains('storage.googleapis.com')) {
      return trimmed;
    }
    const imageExtensions = [
      '.jpg',
      '.jpeg',
      '.png',
      '.gif',
      '.webp',
      '.heic',
      '.bmp',
    ];
    final path = uri.path.toLowerCase();
    if (imageExtensions.any(path.endsWith)) return trimmed;
    return null;
  }

  /// Short inbox-preview label: `'📷 Photo'` for image messages.
  static String previewText(String text) {
    if (imageUrlFromText(text) != null) return '📷 Photo';
    return text;
  }
}

/// Represents a conversation entry in the messages list (inbox).
class ChatConversation {
  const ChatConversation({
    required this.id,
    required this.name,
    required this.lastMessage,
    required this.time,
    this.unreadCount = 0,
    this.isGroup = false,
    this.avatarAsset,
  });

  final String id;
  final String name;
  final String lastMessage;
  final String time;
  final int unreadCount;
  final bool isGroup;
  final String? avatarAsset;
}
