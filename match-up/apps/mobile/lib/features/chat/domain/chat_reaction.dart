/// Emoji reactions on group-chat messages.
/// Reactions are stored per message as `emoji → uids` (see `ChatRepository.watchReactions`).
const reactionEmojis = [
  '❤️',
  '😂',
  '👍',
  '👏',
  '🔥',
  '😮',
  '😢',
  '🙏',
  '🎉',
  '💯',
];

/// Reactions for one message: emoji → uids that reacted with it.
typedef EmojiReactions = Map<String, List<String>>;

/// All reactions in one activity chat: messageId → ([EmojiReactions]).
typedef MessageReactions = Map<String, EmojiReactions>;

/// Parses the backend reaction payload (`{messageId: {emoji: [uid]}}`) into a [MessageReactions].
MessageReactions parseReactionMap(dynamic value) {
  final out = <String, EmojiReactions>{};
  if (value is! Map) return out;
  for (final messageEntry in value.entries) {
    final messageId = messageEntry.key?.toString() ?? '';
    final byEmoji = messageEntry.value;
    if (messageId.isEmpty || byEmoji is! Map) continue;
    final reactions = <String, List<String>>{};
    for (final emojiEntry in byEmoji.entries) {
      final emoji = emojiEntry.key?.toString() ?? '';
      if (emoji.isEmpty) continue;
      // The RTDB listener sees `{uid: timestamp}` maps while the HTTP fallback serves `[uid]` arrays — accept both.
      final uids = <String>[];
      final rawUids = emojiEntry.value;
      if (rawUids is List) {
        for (final u in rawUids) {
          final s = u?.toString() ?? '';
          if (s.isNotEmpty) uids.add(s);
        }
      } else if (rawUids is Map) {
        for (final u in rawUids.keys) {
          final s = u?.toString() ?? '';
          if (s.isNotEmpty) uids.add(s);
        }
      } else {
        continue;
      }
      if (uids.isEmpty) continue;
      reactions[emoji] = uids;
    }
    if (reactions.isNotEmpty) out[messageId] = reactions;
  }
  return out;
}

/// Total reaction count on one message (across all emoji).
int reactionCount(EmojiReactions? reactions) {
  if (reactions == null) return 0;
  return reactions.values.fold(0, (sum, uids) => sum + uids.length);
}

/// True when [uid] reacted with any emoji on this message.
bool hasReacted(EmojiReactions? reactions, String uid) {
  if (reactions == null || uid.isEmpty) return false;
  return reactions.values.any((uids) => uids.contains(uid));
}
