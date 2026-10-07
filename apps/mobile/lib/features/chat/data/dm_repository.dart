import 'dart:async';

import 'package:firebase_database/firebase_database.dart';
import 'package:flutter/foundation.dart';

import '../../../core/network/api_client.dart';
import '../../../core/services/rtdb_auth_service.dart';
import '../../../core/services/storage_service.dart';
import '../../../core/storage/secure_token_store.dart';
import '../../../core/utils/stream_timeout.dart';
import '../domain/chat_message.dart';

/// Canonical 1-on-1 thread id — sorted uids joined with `_`, mirroring backend `dmThreadId` in `database/paths.ts`.
String dmThreadId(String uidA, String uidB) {
  final pair = [uidA.trim(), uidB.trim()]..sort();
  return '${pair[0]}_${pair[1]}';
}

/// Read contract for 1-on-1 direct messages.
/// Text, photo, and location shares (same text-carrying wire format as the group chat repository.
/// Inbox rows reuse [ChatConversation] (`id` = peer uid, `isGroup` = false).
abstract class DmRepository {
  Stream<List<ChatMessage>> watchMessages(String otherUid);
  Future<List<ChatMessage>> messages(String otherUid, {int limit = 50});
  Future<ChatMessage> send({required String otherUid, required String text});

  /// Shares a photo: uploads to Storage, posts the download URL as the message text.
  Future<ChatMessage> sendImage({
    required String otherUid,
    required String imagePath,
  });

  /// Shares the current location as a maps link message.
  Future<ChatMessage> sendLocation({
    required String otherUid,
    required double latitude,
    required double longitude,
  });

  /// Inbox threads, newest first, with peer names + unread badges.
  Future<List<ChatConversation>> conversations();

  /// [conversations] re-emitted on every RTDB inbox change (plus HTTP polling fallback).
  Stream<List<ChatConversation>> watchConversations();

  /// Clears the unread badge for one thread. Best-effort.
  Future<void> markRead(String otherUid);
}

/// HTTP + RTDB implementation against `/api/dm/:uid/...`.
class RemoteDmRepository implements DmRepository {
  RemoteDmRepository({ApiClient? client})
    : _client = client ?? ApiClient.instance;

  final ApiClient _client;

  Future<String> _myUid() async =>
      await SecureTokenStore.instance.readUserId() ?? '';

  @override
  Stream<List<ChatMessage>> watchMessages(String otherUid) async* {
    // RTDB first, HTTP polling fallback — mirrors RemoteChatRepository.
    try {
      await RtdbAuthService.instance.ensureSignedIn();
      final myUid = await _myUid();
      final ref = FirebaseDatabase.instance.ref(
        'dmChats/${dmThreadId(myUid, otherUid)}/messages',
      );
      // First-event watchdog (see RemoteChatRepository): a stalled socket must fall through to polling.
      await for (final event in withFirstEventTimeout(ref.onValue)) {
        yield _parseList(event.snapshot.value, myUid: myUid);
      }
      return;
    } catch (e, st) {
      debugPrint(
        '[RemoteDmRepository.watchMessages] RTDB failed, polling: $e\n$st',
      );
    }
    // Polling fallback with error backoff: consecutive failures stretch the delay.
    var failures = 0;
    while (true) {
      try {
        yield await messages(otherUid);
        failures = 0;
      } catch (_) {
        if (failures < 5) failures++;
      }
      await Future<void>.delayed(
        failures == 0
            ? const Duration(seconds: 3)
            : Duration(seconds: 2 * failures),
      );
    }
  }

  @override
  Future<List<ChatMessage>> messages(String otherUid, {int limit = 50}) async {
    try {
      final res = await _client.dio.get(
        '/dm/$otherUid/messages',
        queryParameters: {'limit': limit},
      );
      final myUid = await _myUid();
      final rows = apiDataList(res.data);
      return [
        for (final e in rows)
          if (e is Map<String, dynamic>) _parseOne(e, myUid: myUid),
      ];
    } catch (e, st) {
      debugPrint('[RemoteDmRepository.messages] $e\n$st');
      return const [];
    }
  }

  @override
  Future<List<ChatConversation>> conversations() async {
    try {
      final res = await _client.dio.get('/dm/conversations');
      final rows = apiDataList(res.data);
      return [
        for (final e in rows)
          if (e is Map<String, dynamic>) _parseThread(e),
      ];
    } catch (e, st) {
      debugPrint('[RemoteDmRepository.conversations] $e\n$st');
      return const [];
    }
  }

  @override
  Stream<List<ChatConversation>> watchConversations() async* {
    // RTDB inbox node drives refetches; the HTTP list carries the enriched peer names the raw entries lack.
    try {
      await RtdbAuthService.instance.ensureSignedIn();
      final myUid = await _myUid();
      final ref = FirebaseDatabase.instance.ref('userDMs/$myUid');
      await for (final _ in withFirstEventTimeout(ref.onValue)) {
        yield await conversations();
      }
      return;
    } catch (e, st) {
      debugPrint(
        '[RemoteDmRepository.watchConversations] RTDB failed: $e\n$st',
      );
    }
    // Same error-backoff shape as [watchMessages]: healthy ticks stay at 10s.
    var failures = 0;
    while (true) {
      try {
        yield await conversations();
        failures = 0;
      } catch (_) {
        if (failures < 5) failures++;
      }
      await Future<void>.delayed(
        failures == 0
            ? const Duration(seconds: 10)
            : Duration(seconds: 2 * failures),
      );
    }
  }

  @override
  Future<void> markRead(String otherUid) async {
    try {
      await _client.dio.post('/dm/$otherUid/read');
    } catch (e, st) {
      debugPrint('[RemoteDmRepository.markRead] $e\n$st');
    }
  }

  ChatConversation _parseThread(Map<String, dynamic> json) {
    final peerUid = json['peerUid']?.toString() ?? '';
    final displayName = json['displayName']?.toString().trim() ?? '';
    final ms = json['lastTimestamp'];
    final sentAt = ms is num
        ? DateTime.fromMillisecondsSinceEpoch(ms.toInt())
        : null;
    // Never leak a raw download URL / maps link into the inbox row.
    final rawPreview = json['lastText']?.toString() ?? '';
    final preview = parseSharedLocation(rawPreview) != null
        ? '📍 Location'
        : ChatMessage.previewText(rawPreview);
    return ChatConversation(
      id: peerUid,
      name: displayName.isNotEmpty ? displayName : peerUid,
      lastMessage: preview,
      time: sentAt == null ? '' : _relativeTime(sentAt),
      unreadCount: (json['unreadCount'] as num?)?.toInt() ?? 0,
    );
  }

  String _relativeTime(DateTime sentAt) {
    final diff = DateTime.now().difference(sentAt);
    if (diff.inMinutes < 1) return 'Just now';
    if (diff.inHours < 1) return '${diff.inMinutes}m ago';
    if (diff.inHours < 24) return '${diff.inHours}h ago';
    if (diff.inDays == 1) return 'Yesterday';
    return '${diff.inDays}d ago';
  }

  @override
  Future<ChatMessage> send({
    required String otherUid,
    required String text,
  }) async {
    final res = await _client.dio.post(
      '/dm/$otherUid/messages',
      data: {'text': text},
    );
    final messageId =
        apiDataMap(res.data)?['messageId']?.toString() ??
        '${DateTime.now().millisecondsSinceEpoch}';
    final myUid = await _myUid();
    return ChatMessage(
      id: messageId,
      senderId: myUid,
      senderName: 'You',
      text: text,
      sentAt: DateTime.now(),
      isMine: true,
    );
  }

  @override
  Future<ChatMessage> sendImage({
    required String otherUid,
    required String imagePath,
  }) async {
    // Same text-only wire format as group chat: upload to Storage first, post the download URL as the text.
    final myUid = await _myUid();
    await StorageService.checkImageSize(imagePath, kMaxChatImageBytes);
    // Owner-scoped path (see StorageService.uploadChatAttachment).
    if (myUid.isEmpty) {
      throw Exception('Photo uploads are unavailable right now');
    }
    final uploadedUrl = await StorageService.instance.uploadChatAttachment(
      localPath: imagePath,
      scope: 'dm_${dmThreadId(myUid, otherUid)}',
      uid: myUid,
    );
    if (uploadedUrl == null) {
      // Same contract as the group chat path: the photo cannot leave the device.
      throw Exception('Photo uploads are unavailable right now');
    }
    final sent = await send(otherUid: otherUid, text: uploadedUrl);
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
  }

  @override
  Future<ChatMessage> sendLocation({
    required String otherUid,
    required double latitude,
    required double longitude,
  }) async {
    final sent = await send(
      otherUid: otherUid,
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
  }

  List<ChatMessage> _parseList(Object? value, {required String myUid}) =>
      parseRtdbDmMessages(value, myUid: myUid);

  ChatMessage _parseOne(Map<String, dynamic> json, {required String myUid}) {
    final senderId = json['senderId']?.toString() ?? '';
    final ms = json['timestamp'];
    final text = json['text']?.toString() ?? '';
    final coords = parseSharedLocation(text);
    return ChatMessage(
      id: json['messageId']?.toString() ?? json['id']?.toString() ?? '',
      senderId: senderId,
      senderName: senderId == myUid ? 'You' : '',
      text: text,
      sentAt: ms is num
          ? DateTime.fromMillisecondsSinceEpoch(ms.toInt())
          : DateTime.now(),
      isMine: senderId == myUid && senderId.isNotEmpty,
      imageUrl: ChatMessage.imageUrlFromText(text),
      latitude: coords?.latitude,
      longitude: coords?.longitude,
      messageType: json['type']?.toString() == 'system' ? 'system' : 'text',
    );
  }
}

/// Coordinates carried by a `'📍 Shared location: <maps link>'` message.
({double latitude, double longitude})? parseSharedLocation(String text) {
  const prefix = '📍 Shared location: ';
  if (!text.startsWith(prefix)) return null;
  final link = text.substring(prefix.length).trim();
  final uri = Uri.tryParse(link);
  if (uri == null) return null;
  // Group chat writes `https://maps.google.com/?q=<lat>,<lng>`.
  final q = uri.queryParameters['q'];
  if (q == null) return null;
  final parts = q.split(',');
  if (parts.length != 2) return null;
  final lat = double.tryParse(parts[0].trim());
  final lng = double.tryParse(parts[1].trim());
  if (lat == null || lng == null) return null;
  return (latitude: lat, longitude: lng);
}

/// Parses an RTDB `dmChats/{pair}/messages` snapshot value into time-sorted messages.
/// Top-level (not a method) so unit tests can feed it realistic snapshot shapes.
List<ChatMessage> parseRtdbDmMessages(Object? value, {required String myUid}) {
  if (value is! Map) return const [];
  final out = <ChatMessage>[];
  for (final entry in value.entries.whereType<MapEntry<dynamic, dynamic>>()) {
    final v = entry.value;
    if (v is Map) {
      final json = <String, dynamic>{
        'messageId': entry.key.toString(),
        ...Map<String, dynamic>.from(v),
      };
      out.add(_parseDmMessage(json, myUid: myUid));
    }
  }
  out.sort((a, b) => a.sentAt.compareTo(b.sentAt));
  return out;
}

ChatMessage _parseDmMessage(
  Map<String, dynamic> json, {
  required String myUid,
}) {
  final senderId = json['senderId']?.toString() ?? '';
  final ms = json['timestamp'];
  final text = json['text']?.toString() ?? '';
  final coords = parseSharedLocation(text);
  return ChatMessage(
    id: json['messageId']?.toString() ?? json['id']?.toString() ?? '',
    senderId: senderId,
    senderName: senderId == myUid ? 'You' : '',
    text: text,
    sentAt: ms is num
        ? DateTime.fromMillisecondsSinceEpoch(ms.toInt())
        : DateTime.now(),
    isMine: senderId == myUid && senderId.isNotEmpty,
    imageUrl: ChatMessage.imageUrlFromText(text),
    latitude: coords?.latitude,
    longitude: coords?.longitude,
    messageType: json['type']?.toString() == 'system' ? 'system' : 'text',
  );
}
