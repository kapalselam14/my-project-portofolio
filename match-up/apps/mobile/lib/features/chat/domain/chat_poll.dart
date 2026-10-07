/// Single-choice group-chat poll ("Play at 4 or 5?").
/// Each member holds at most one vote; voting the same option again retracts it (see `votePoll` in `chat.service.ts`).
class ChatPoll {
  const ChatPoll({
    required this.pollId,
    required this.question,
    required this.options,
    required this.createdBy,
    required this.createdAt,
    this.votes = const <int, List<String>>{},
  });

  final String pollId;
  final String question;
  final List<String> options;
  final String createdBy;
  final DateTime createdAt;

  /// optionIndex → uids that voted for it.
  final Map<int, List<String>> votes;

  /// Total votes across all options.
  int get totalVotes => votes.values.fold(0, (sum, uids) => sum + uids.length);

  int votesFor(int index) => votes[index]?.length ?? 0;

  double shareFor(int index) {
    final total = totalVotes;
    if (total == 0) return 0;
    return votesFor(index) / total;
  }

  /// The option index [uid] voted for, or `null` when they haven't voted.
  int? myVote(String uid) {
    if (uid.isEmpty) return null;
    for (final entry in votes.entries) {
      if (entry.value.contains(uid)) return entry.key;
    }
    return null;
  }
}

/// Parses the backend poll payload into a time-ordered list.
List<ChatPoll> parsePollList(dynamic value) {
  final entries = <Map<String, dynamic>>[];
  if (value is List) {
    for (final e in value) {
      if (e is Map) entries.add(Map<String, dynamic>.from(e));
    }
  } else if (value is Map) {
    for (final e in value.entries) {
      if (e.value is! Map) continue;
      final json = Map<String, dynamic>.from(e.value as Map);
      json.putIfAbsent('pollId', () => e.key.toString());
      entries.add(json);
    }
  } else {
    return const [];
  }

  final polls = <ChatPoll>[];
  for (final json in entries) {
    final poll = _parseOne(json);
    if (poll != null) polls.add(poll);
  }
  polls.sort((a, b) => a.createdAt.compareTo(b.createdAt));
  return polls;
}

ChatPoll? _parseOne(Map<String, dynamic> json) {
  final pollId = json['pollId']?.toString() ?? '';
  final question = json['question'] as String? ?? '';
  final rawOptions = json['options'];
  final createdBy = json['createdBy']?.toString() ?? '';
  if (pollId.isEmpty || question.isEmpty || createdBy.isEmpty) return null;
  if (rawOptions is! List) return null;
  final options = rawOptions
      .map((o) => o?.toString() ?? '')
      .where((o) => o.isNotEmpty)
      .toList();
  if (options.length < 2) return null;
  return ChatPoll(
    pollId: pollId,
    question: question,
    options: options,
    createdBy: createdBy,
    createdAt: _parseTime(json['createdAt']) ?? DateTime.now(),
    votes: _parseVotes(json['votes']),
  );
}

Map<int, List<String>> _parseVotes(dynamic raw) {
  final votes = <int, List<String>>{};
  if (raw is! Map) return votes;
  for (final e in raw.entries) {
    final index = int.tryParse(e.key.toString());
    if (index == null) continue;
    final uids = <String>[];
    final byUid = e.value;
    if (byUid is List) {
      for (final u in byUid) {
        final s = u?.toString() ?? '';
        if (s.isNotEmpty) uids.add(s);
      }
    } else if (byUid is Map) {
      for (final u in byUid.keys) {
        final s = u?.toString() ?? '';
        if (s.isNotEmpty) uids.add(s);
      }
    } else {
      continue;
    }
    if (uids.isNotEmpty) votes[index] = uids;
  }
  return votes;
}

DateTime? _parseTime(dynamic raw) {
  if (raw == null) return null;
  if (raw is DateTime) return raw;
  if (raw is String) return DateTime.tryParse(raw);
  if (raw is num) {
    final ms = raw.toInt() < 100000000000 ? raw.toInt() * 1000 : raw.toInt();
    return DateTime.fromMillisecondsSinceEpoch(ms);
  }
  return null;
}
