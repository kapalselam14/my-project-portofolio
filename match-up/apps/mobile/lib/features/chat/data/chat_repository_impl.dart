// Group chat: RTDB realtime stream first, HTTP polling fallback (3 s, backoff + 429 breaker) when the socket stalls.
import 'dart:async';

import 'package:dio/dio.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_database/firebase_database.dart';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../../core/network/api_client.dart';
import '../../../core/services/rtdb_auth_service.dart';
import '../../../core/services/storage_service.dart';
import '../../../core/storage/secure_token_store.dart';
import '../../../core/utils/stream_timeout.dart';
import '../../discovery/data/remote_activity_repository.dart';
import '../domain/chat_message.dart';
import '../domain/chat_poll.dart';
import '../domain/chat_reaction.dart';
import 'chat_repository.dart';
import 'dm_repository.dart' show parseSharedLocation;

class LocalChatRepository implements ChatRepository {
  /// Offline-only chat store.
  @override
  Future<List<ChatMessage>> messages(String activityId) async {
    return const <ChatMessage>[];
  }

  @override
  Stream<List<ChatMessage>> watchMessages(String activityId) async* {
    yield const <ChatMessage>[];
  }

  @override
  Future<ChatMessage> send({
    required String activityId,
    required String text,
  }) async {
    throw StateError(
      'ChatRepository.send() requires a live backend — no offline '
      'fallback is provided.',
    );
  }

  @override
  Future<ChatMessage> sendImage({
    required String activityId,
    required String imagePath,
  }) async {
    throw StateError(
      'ChatRepository.sendImage() requires a live backend — no offline '
      'fallback is provided.',
    );
  }

  @override
  Future<ChatMessage> sendLocation({
    required String activityId,
    required double latitude,
    required double longitude,
  }) async {
    throw StateError(
      'ChatRepository.sendLocation() requires a live backend — no '
      'offline fallback is provided.',
    );
  }

  @override
  Future<List<ChatConversation>> conversations() async {
    return const <ChatConversation>[];
  }

  @override
  Stream<MessageReactions> watchReactions(String activityId) async* {
    yield const <String, EmojiReactions>{};
  }

  @override
  Future<bool?> toggleReaction({
    required String activityId,
    required String messageId,
    required String emoji,
  }) async {
    return null;
  }

  @override
  Stream<List<ChatPoll>> watchPolls(String activityId) async* {
    yield const <ChatPoll>[];
  }

  @override
  Future<String?> createPoll({
    required String activityId,
    required String question,
    required List<String> options,
  }) async {
    return null;
  }

  @override
  Future<bool?> votePoll({
    required String activityId,
    required String pollId,
    required int optionIndex,
  }) async {
    return null;
  }
}

class RemoteChatRepository implements ChatRepository {
  RemoteChatRepository({
    ApiClient? client,
    ChatRepository? fallback,
    RemoteActivityRepository? activities,
  }) : _client = client ?? ApiClient.instance,
       _fallback = fallback ?? LocalChatRepository(),
       _activities = activities ?? RemoteActivityRepository();

  final ApiClient _client;
  final ChatRepository _fallback;
  final RemoteActivityRepository _activities;

  /// Polling interval for the HTTP fallback.
  static const Duration _pollingInterval = Duration(seconds: 3);

  /// 429 circuit-breaker for the HTTP polling fallbacks (messages, reactions, polls).
  DateTime? _pollBlockedUntil;

  bool get _pollBlocked =>
      _pollBlockedUntil != null && DateTime.now().isBefore(_pollBlockedUntil!);

  void _notePollRateLimit(Object e) {
    if (e is! DioException || e.response?.statusCode != 429) return;
    final raw = e.response?.headers.value('retry-after');
    final secs = int.tryParse(raw?.trim() ?? '');
    final wait = (secs != null && secs > 0 && secs <= 300)
        ? Duration(seconds: secs)
        : const Duration(seconds: 30);
    _pollBlockedUntil = DateTime.now().add(wait);
    debugPrint(
      '[RemoteChatRepository] 429 — pausing polls until $_pollBlockedUntil',
    );
  }

  /// uid → sender profile cache per activity, so chat bubbles show names and avatars without an N+1 profile lookup.
  final Map<String, _SenderCache> _senderCache = {};

  @override
  Future<List<ChatMessage>> messages(String activityId) async {
    try {
      final res = await _client.dio.get('/chat/$activityId/messages');
      final myUid = await SecureTokenStore.instance.readUserId() ?? '';
      final senders = await _senderProfiles(activityId);
      return apiDataList(res.data)
          .whereType<Map<String, dynamic>>()
          .map((m) => _parse(m, myUid: myUid, senders: senders))
          .whereType<ChatMessage>()
          .toList();
    } catch (e, st) {
      _notePollRateLimit(e);
      debugPrint('[RemoteChatRepository.messages] $e\n$st');
      return _fallback.messages(activityId);
    }
  }

  /// Resolves sender uids to display names + avatar URLs via the activity roster.
  Future<Map<String, _SenderProfile>> _senderProfiles(String activityId) async {
    final cached = _senderCache[activityId];
    if (cached != null &&
        DateTime.now().difference(cached.fetchedAt) <
            const Duration(minutes: 1)) {
      return cached.senders;
    }
    try {
      final roster = await _activities.participants(activityId);
      final senders = <String, _SenderProfile>{
        for (final p in roster)
          p.userId: _SenderProfile(name: p.name, avatarUrl: p.avatarUrl),
      };
      _senderCache[activityId] = _SenderCache(senders, DateTime.now());
      // Cap the per-activity cache: drop the stalest entries beyond 100 so long sessions can't grow it without bound.
      while (_senderCache.length > 100) {
        var oldestKey = _senderCache.keys.first;
        var oldestAt = _senderCache[oldestKey]!.fetchedAt;
        for (final entry in _senderCache.entries) {
          if (entry.value.fetchedAt.isBefore(oldestAt)) {
            oldestKey = entry.key;
            oldestAt = entry.value.fetchedAt;
          }
        }
        _senderCache.remove(oldestKey);
      }
      return senders;
    } catch (_) {
      final stale = _senderCache[activityId];
      if (stale != null) return stale.senders;
      return const {};
    }
  }

  @override
  Stream<List<ChatMessage>> watchMessages(String activityId) async* {
    // Try the RTDB-backed real-time path first.
    if (_isFirebaseReady()) {
      try {
        // Make sure the SDK session exists before subscribing.
        await RtdbAuthService.instance.ensureSignedIn();
        final myUid = await SecureTokenStore.instance.readUserId() ?? '';
        final senders = await _senderProfiles(activityId);
        // First-event watchdog: a stalled RTDB socket emits neither data nor error, which would pin the chat on its.
        await for (final messages in withFirstEventTimeout(
          _watchViaRtdb(activityId, myUid: myUid, senders: senders),
        )) {
          yield messages;
        }
        return;
      } catch (e, st) {
        debugPrint(
          '[RemoteChatRepository.watchMessages] RTDB failed, '
          'falling back to polling: $e\n$st',
        );
      }
    }
    yield* _watchViaPolling(activityId);
  }

  /// Real-time path: subscribe to `activityChats/{activityId}/messages` in the Firebase Realtime Database.
  Stream<List<ChatMessage>> _watchViaRtdb(
    String activityId, {
    required String myUid,
    required Map<String, _SenderProfile> senders,
  }) {
    final ref = FirebaseDatabase.instance.ref(
      'activityChats/$activityId/messages',
    );
    return ref.onValue.map((event) {
      final value = event.snapshot.value;
      if (value is! Map) return <ChatMessage>[];
      final messages =
          value.entries
              .whereType<MapEntry<dynamic, dynamic>>()
              .map(
                (e) => _parseRtdbMessage(
                  e.key.toString(),
                  e.value,
                  myUid: myUid,
                  senders: senders,
                ),
              )
              .whereType<ChatMessage>()
              .toList()
            ..sort((a, b) => a.sentAt.compareTo(b.sentAt));
      return messages;
    });
  }

  /// Polling fallback. Less efficient than RTDB but works without any Firebase config.
  Stream<List<ChatMessage>> _watchViaPolling(String activityId) async* {
    final controller = StreamController<List<ChatMessage>>();
    Timer? timer;

    Future<void> tick() async {
      if (_pollBlocked) return;
      try {
        final latest = await messages(activityId);
        if (!controller.isClosed) controller.add(latest);
      } catch (e) {
        _notePollRateLimit(e);
        if (!controller.isClosed) controller.addError(e);
      }
    }

    // Emit immediately, then on each tick.
    unawaited(tick());
    timer = Timer.periodic(_pollingInterval, (_) => tick());

    controller.onCancel = () {
      timer?.cancel();
      timer = null;
    };

    yield* controller.stream;
  }

  /// Real-time stream of emoji reactions for [activityId], keyed by message id.
  @override
  Stream<MessageReactions> watchReactions(String activityId) async* {
    if (_isFirebaseReady()) {
      try {
        await RtdbAuthService.instance.ensureSignedIn();
        await for (final reactions in withFirstEventTimeout(
          _watchReactionsViaRtdb(activityId),
        )) {
          yield reactions;
        }
        return;
      } catch (e, st) {
        debugPrint(
          '[RemoteChatRepository.watchReactions] RTDB failed, '
          'falling back to polling: $e\n$st',
        );
      }
    }
    yield* _watchReactionsViaPolling(activityId);
  }

  Stream<MessageReactions> _watchReactionsViaRtdb(String activityId) {
    final ref = FirebaseDatabase.instance.ref(
      'activityChats/$activityId/reactions',
    );
    return ref.onValue.map((event) => parseReactionMap(event.snapshot.value));
  }

  Stream<MessageReactions> _watchReactionsViaPolling(String activityId) async* {
    final controller = StreamController<MessageReactions>();
    Timer? timer;

    Future<void> tick() async {
      if (_pollBlocked) return;
      try {
        final res = await _client.dio.get('/chat/$activityId/reactions');
        final latest = parseReactionMap(apiDataMap(res.data));
        if (!controller.isClosed) controller.add(latest);
      } catch (e) {
        _notePollRateLimit(e);
        if (!controller.isClosed) controller.addError(e);
      }
    }

    unawaited(tick());
    timer = Timer.periodic(_pollingInterval, (_) => tick());

    controller.onCancel = () {
      timer?.cancel();
      timer = null;
    };

    yield* controller.stream;
  }

  /// Toggles the current user's [emoji] reaction on one message via `POST.
  @override
  Future<bool?> toggleReaction({
    required String activityId,
    required String messageId,
    required String emoji,
  }) async {
    try {
      final res = await _client.dio.post(
        '/chat/$activityId/messages/$messageId/reactions',
        data: {'emoji': emoji},
      );
      final reacted = apiDataMap(res.data)?['reacted'];
      if (reacted is bool) return reacted;
      return null;
    } catch (e, st) {
      debugPrint('[RemoteChatRepository.toggleReaction] $e\n$st');
      if (e is DioException && (e.response?.statusCode ?? 0) ~/ 100 == 4) {
        rethrow;
      }
      return null;
    }
  }

  /// Real-time stream of polls for [activityId].
  @override
  Stream<List<ChatPoll>> watchPolls(String activityId) async* {
    if (_isFirebaseReady()) {
      try {
        await RtdbAuthService.instance.ensureSignedIn();
        await for (final polls in withFirstEventTimeout(
          _watchPollsViaRtdb(activityId),
        )) {
          yield polls;
        }
        return;
      } catch (e, st) {
        debugPrint(
          '[RemoteChatRepository.watchPolls] RTDB failed, '
          'falling back to polling: $e\n$st',
        );
      }
    }
    yield* _watchPollsViaPolling(activityId);
  }

  Stream<List<ChatPoll>> _watchPollsViaRtdb(String activityId) {
    final ref = FirebaseDatabase.instance.ref(
      'activityChats/$activityId/polls',
    );
    return ref.onValue.map((event) => parsePollList(event.snapshot.value));
  }

  Stream<List<ChatPoll>> _watchPollsViaPolling(String activityId) async* {
    final controller = StreamController<List<ChatPoll>>();
    Timer? timer;

    Future<void> tick() async {
      if (_pollBlocked) return;
      try {
        final res = await _client.dio.get('/chat/$activityId/polls');
        final latest = parsePollList(apiDataList(res.data));
        if (!controller.isClosed) controller.add(latest);
      } catch (e) {
        _notePollRateLimit(e);
        if (!controller.isClosed) controller.addError(e);
      }
    }

    unawaited(tick());
    timer = Timer.periodic(_pollingInterval, (_) => tick());

    controller.onCancel = () {
      timer?.cancel();
      timer = null;
    };

    yield* controller.stream;
  }

  /// Creates a poll via `POST /chat/:activityId/polls`.
  @override
  Future<String?> createPoll({
    required String activityId,
    required String question,
    required List<String> options,
  }) async {
    try {
      final res = await _client.dio.post(
        '/chat/$activityId/polls',
        data: {'question': question, 'options': options},
      );
      final pollId = apiDataMap(res.data)?['pollId']?.toString();
      if (pollId == null || pollId.isEmpty) return null;
      return pollId;
    } catch (e, st) {
      debugPrint('[RemoteChatRepository.createPoll] $e\n$st');
      return null;
    }
  }

  /// Votes via `POST /chat/:activityId/polls/:pollId/votes`.
  @override
  Future<bool?> votePoll({
    required String activityId,
    required String pollId,
    required int optionIndex,
  }) async {
    try {
      final res = await _client.dio.post(
        '/chat/$activityId/polls/$pollId/votes',
        data: {'optionIndex': optionIndex},
      );
      final voted = apiDataMap(res.data)?['voted'];
      if (voted is bool) return voted;
      return null;
    } catch (e, st) {
      debugPrint('[RemoteChatRepository.votePoll] $e\n$st');
      // Same as send(): a decided 4xx.
      if (e is DioException && (e.response?.statusCode ?? 0) ~/ 100 == 4) {
        rethrow;
      }
      return null;
    }
  }

  /// Parses a single RTDB message entry.
  ChatMessage? _parseRtdbMessage(
    String id,
    dynamic raw, {
    required String myUid,
    required Map<String, _SenderProfile> senders,
  }) {
    if (raw is! Map) return null;
    final json = Map<String, dynamic>.from(raw);
    final senderId = json['senderId']?.toString() ?? '';
    final text = json['text'] as String? ?? '';
    if (senderId.isEmpty || text.isEmpty) return null;
    final isMine = myUid.isNotEmpty && senderId == myUid;
    final sender = senders[senderId];
    // Location shares travel as text (`'📍 Shared location: <maps link>'`) on the wire.
    final coords = parseSharedLocation(text);
    return ChatMessage(
      id: id,
      senderId: senderId,
      senderName: isMine ? 'You' : (sender?.name ?? senderId),
      senderAvatarUrl: isMine ? null : sender?.avatarUrl,
      text: text,
      sentAt: _parseTimestamp(json['timestamp']) ?? DateTime.now(),
      isMine: isMine,
      imageUrl: ChatMessage.imageUrlFromText(text),
      latitude: coords?.latitude,
      longitude: coords?.longitude,
      messageType: json['type']?.toString() == 'system' ? 'system' : 'text',
    );
  }

  /// Coerces a Firestore / RTDB timestamp (ISO string, epoch number, or `{ seconds.
  DateTime? _parseTimestamp(dynamic raw) {
    if (raw == null) return null;
    if (raw is DateTime) return raw;
    if (raw is String) return DateTime.tryParse(raw);
    if (raw is num) {
      // Server timestamps are typically epoch seconds, but Firebase JS SDKs sometimes serialise as milliseconds.
      final ms = raw.toInt() < 100000000000 ? raw.toInt() * 1000 : raw.toInt();
      return DateTime.fromMillisecondsSinceEpoch(ms);
    }
    if (raw is Map) {
      final seconds = raw['seconds'] ?? raw['_seconds'];
      if (seconds is num) {
        return DateTime.fromMillisecondsSinceEpoch(seconds.toInt() * 1000);
      }
    }
    return null;
  }

  /// True if Firebase has been initialised (apps list non-empty).
  bool _isFirebaseReady() {
    try {
      return Firebase.apps.isNotEmpty;
    } catch (_) {
      return false;
    }
  }

  @override
  Future<ChatMessage> send({
    required String activityId,
    required String text,
  }) async {
    try {
      // Canonical route is `POST /api/chat/messages` with the activity id in the body.
      final res = await _client.dio.post(
        '/chat/messages',
        data: {'activityId': activityId, 'text': text},
      );
      final messageId =
          apiDataMap(res.data)?['messageId']?.toString() ??
          '$activityId-${DateTime.now().millisecondsSinceEpoch}';
      final myUid = await SecureTokenStore.instance.readUserId() ?? '';
      return ChatMessage(
        id: messageId,
        senderId: myUid,
        senderName: 'You',
        text: text,
        sentAt: DateTime.now(),
        isMine: true,
      );
    } catch (e, st) {
      debugPrint('[RemoteChatRepository.send] $e\n$st');
      // Server rejections (4xx with a decision.
      if (e is DioException && (e.response?.statusCode ?? 0) ~/ 100 == 4) {
        rethrow;
      }
      return _fallback.send(activityId: activityId, text: text);
    }
  }

  @override
  Future<ChatMessage> sendImage({
    required String activityId,
    required String imagePath,
  }) async {
    // The backend stores text-only messages, so images upload to Firebase Storage first.
    try {
      // Fail fast on oversized picks (8 MB server cap): the denial must surface as a "too large" alert.
      await StorageService.checkImageSize(imagePath, kMaxChatImageBytes);
      // Owner-scoped path so only the uploader can overwrite or delete the file.
      final myUid = await SecureTokenStore.instance.readUserId() ?? '';
      if (myUid.isEmpty) {
        throw Exception('Photo uploads are unavailable right now');
      }
      final uploadedUrl = await StorageService.instance.uploadChatAttachment(
        localPath: imagePath,
        scope: activityId,
        uid: myUid,
      );
      if (uploadedUrl == null) {
        // Storage returns null for every failure mode (unconfigured Firebase, missing file, failed upload.
        throw Exception('Photo uploads are unavailable right now');
      }
      final sent = await send(activityId: activityId, text: uploadedUrl);
      return ChatMessage(
        id: sent.id,
        senderId: sent.senderId,
        senderName: sent.senderName,
        text: sent.text,
        sentAt: sent.sentAt,
        isMine: true,
        imagePath: imagePath,
        imageUrl: uploadedUrl,
      );
    } catch (e, st) {
      debugPrint('[RemoteChatRepository.sendImage] $e\n$st');
      // The upload-unavailable and too-large signals must reach the screen verbatim.
      if (e is ImageTooLargeException) rethrow;
      if (e.toString().contains('Photo uploads are unavailable')) rethrow;
      return _fallback.sendImage(activityId: activityId, imagePath: imagePath);
    }
  }

  @override
  Future<ChatMessage> sendLocation({
    required String activityId,
    required double latitude,
    required double longitude,
  }) async {
    // Same text-only constraint as images: the coordinates travel as a maps link inside a regular message.
    try {
      final sent = await send(
        activityId: activityId,
        text:
            '📍 Shared location: https://maps.google.com/?q=$latitude,$longitude',
      );
      return ChatMessage(
        id: sent.id,
        senderId: sent.senderId,
        senderName: sent.senderName,
        text: sent.text,
        sentAt: sent.sentAt,
        isMine: true,
        latitude: latitude,
        longitude: longitude,
      );
    } catch (e, st) {
      debugPrint('[RemoteChatRepository.sendLocation] $e\n$st');
      return _fallback.sendLocation(
        activityId: activityId,
        latitude: latitude,
        longitude: longitude,
      );
    }
  }

  @override
  Future<List<ChatConversation>> conversations() async {
    // No dedicated backend route — the inbox is derived from the viewer's own activities.
    try {
      final results = await Future.wait([
        _activities.hostedByUser('me', limit: 50),
        _activities.joinedByUser('me', limit: 50),
      ]);
      final seen = <String>{};
      final mine = [
        ...results[0],
        ...results[1],
      ].where((a) => seen.add(a.id)).take(20).toList();
      final lastOpened = await _lastOpenedAt({for (final a in mine) a.id});
      final entries = await Future.wait(
        mine.map((activity) async {
          String lastMessage = '';
          String time = '';
          int unreadCount = 0;
          try {
            final msgs = await messages(activity.id);
            if (msgs.isNotEmpty) {
              final last = msgs.last;
              final who = last.isMine ? 'You' : last.senderName;
              // NOTE: assign the outer `lastMessage` — `var` here would shadow it, silently discarding the preview.
              lastMessage = ChatMessage.previewText(last.text);
              lastMessage = lastMessage.length > 60
                  ? '${lastMessage.substring(0, 60)}…'
                  : lastMessage;
              lastMessage = '$who: $lastMessage';
              time = _relativeTime(last.sentAt);
              // No server-side read state exists on ChatMessage.
              final openedAt = lastOpened[activity.id];
              if (openedAt != null) {
                unreadCount = msgs
                    .where((m) => !m.isMine && m.sentAt.isAfter(openedAt))
                    .length;
              }
            }
          } catch (e, st) {
            // One broken thread must not sink the whole inbox.
            debugPrint(
              '[RemoteChatRepository.conversations] preview failed for '
              '${activity.id}: $e\n$st',
            );
          }
          return ChatConversation(
            id: activity.id,
            name: activity.title,
            lastMessage: lastMessage,
            time: time,
            unreadCount: unreadCount,
            isGroup: true,
          );
        }),
      );
      return entries;
    } catch (e, st) {
      debugPrint('[RemoteChatRepository.conversations] $e\n$st');
      rethrow;
    }
  }

  /// Last-opened timestamps per activity, backing the inbox unread badges (see [recordChatOpened]).
  Future<Map<String, DateTime>> _lastOpenedAt(Set<String> ids) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final out = <String, DateTime>{};
      for (final id in ids) {
        final ms = prefs.getInt('$_lastOpenedPrefix$id');
        if (ms != null) {
          out[id] = DateTime.fromMillisecondsSinceEpoch(ms);
        }
      }
      return out;
    } catch (_) {
      return const {};
    }
  }

  /// Compact relative timestamp for the inbox rows (`2m ago`, `3h ago`, `Yesterday`, `4d ago`).
  String _relativeTime(DateTime sentAt) {
    final diff = DateTime.now().difference(sentAt);
    if (diff.inMinutes < 1) return 'Just now';
    if (diff.inHours < 1) return '${diff.inMinutes}m ago';
    if (diff.inHours < 24) return '${diff.inHours}h ago';
    if (diff.inDays == 1) return 'Yesterday';
    return '${diff.inDays}d ago';
  }

  /// Parses one backend chat message: `{messageId, senderId, text, type, timestamp}`.
  ChatMessage? _parse(
    Map<String, dynamic> json, {
    required String myUid,
    required Map<String, _SenderProfile> senders,
  }) {
    final senderId = json['senderId']?.toString() ?? '';
    final text = json['text'] as String? ?? '';
    if (senderId.isEmpty || text.isEmpty) return null;
    final isMine = myUid.isNotEmpty && senderId == myUid;
    final sender = senders[senderId];
    // Same wire-format handling as the RTDB path above: a location share arrives as text.
    final coords = parseSharedLocation(text);
    return ChatMessage(
      id: json['messageId']?.toString() ?? json['id']?.toString() ?? '',
      senderId: senderId,
      senderName: isMine ? 'You' : (sender?.name ?? senderId),
      senderAvatarUrl: isMine ? null : sender?.avatarUrl,
      text: text,
      sentAt: _parseTimestamp(json['timestamp']) ?? DateTime.now(),
      isMine: isMine,
      imageUrl: ChatMessage.imageUrlFromText(text),
      latitude: coords?.latitude,
      longitude: coords?.longitude,
      messageType: json['type']?.toString() == 'system' ? 'system' : 'text',
    );
  }
}

/// SharedPreferences key prefix for per-activity last-opened timestamps (`<prefix><activityId>` → epoch millis).
const _lastOpenedPrefix = 'chat_last_opened_';

/// Persists "this chat was opened now" for the inbox unread baseline.
Future<void> recordChatOpened(String activityId) async {
  try {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setInt(
      '$_lastOpenedPrefix$activityId',
      DateTime.now().millisecondsSinceEpoch,
    );
  } catch (_) {}
}

/// uid → sender profile snapshot with its fetch time, backing the sender cache in [RemoteChatRepository].
class _SenderCache {
  const _SenderCache(this.senders, this.fetchedAt);
  final Map<String, _SenderProfile> senders;
  final DateTime fetchedAt;
}

/// Display name + avatar URL of one chat participant, resolved from the activity roster.
class _SenderProfile {
  const _SenderProfile({required this.name, this.avatarUrl});
  final String name;
  final String? avatarUrl;
}
