import 'dart:async';
import 'dart:io';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../core/network/api_client.dart';
import '../../../core/providers/auth_state_provider.dart';
import '../../../core/providers/repository_providers.dart';
import '../../../core/services/location_service.dart';
import '../../../core/services/storage_service.dart';
import '../../../core/storage/secure_token_store.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/theme/dark_colors.dart';
import '../../../core/utils/nav_guard.dart';
import '../../../core/widgets/app_avatar.dart';
import '../../../core/widgets/app_scaffold.dart';
import '../../../core/widgets/app_snackbar.dart';
import '../../../core/widgets/error_retry.dart';
import '../../../core/widgets/pressable_scale.dart';
import '../../../core/widgets/skeleton.dart';
import '../../activities/domain/activity_model.dart';
import '../../activities/domain/activity_participant.dart';
import '../../report/presentation/report_activity_sheet.dart';
import '../../notifications/services/push_routing.dart' show mutedChatsKey;
import '../data/chat_repository_impl.dart' show recordChatOpened;
import '../data/typing_repository.dart';
import '../domain/chat_message.dart';
import '../domain/chat_poll.dart';
import '../domain/chat_reaction.dart';
import 'chat_attachment_sheet.dart';
import 'poll_create_sheet.dart';

part 'widgets/chat_header.dart';
part 'widgets/chat_match_banner.dart';
part 'widgets/chat_timeline.dart';
part 'widgets/chat_bubble.dart';
part 'widgets/chat_sheets.dart';
part 'widgets/chat_poll.dart';
part 'widgets/chat_media.dart';
part 'widgets/chat_input_bar.dart';
part 'widgets/chat_settings.dart';

// Provider.

/// Real-time message stream for [id] (the activity id).
/// Wraps `ChatRepository.watchMessages` in an auto-dispose stream family.
final _messagesStreamProvider = StreamProvider.autoDispose
    .family<List<ChatMessage>, String>((ref, id) {
      return ref.watch(chatRepositoryProvider).watchMessages(id);
    });

/// Real-time emoji reactions for [id] (the activity id), keyed by message id.
final _reactionsStreamProvider = StreamProvider.autoDispose
    .family<MessageReactions, String>((ref, id) {
      return ref.watch(chatRepositoryProvider).watchReactions(id);
    });

/// Real-time single-choice polls for [id] (the activity id), oldest first.
final _pollsStreamProvider = StreamProvider.autoDispose
    .family<List<ChatPoll>, String>((ref, id) {
      return ref.watch(chatRepositoryProvider).watchPolls(id);
    });

/// Toggles one emoji reaction, toast on transport failure.
Future<void> _toggleReaction(
  WidgetRef ref,
  BuildContext context, {
  required String activityId,
  required String messageId,
  required String emoji,
}) async {
  try {
    final reacted = await ref
        .read(chatRepositoryProvider)
        .toggleReaction(
          activityId: activityId,
          messageId: messageId,
          emoji: emoji,
        );
    if (reacted == null && context.mounted) {
      AppSnackbar.show(
        context,
        message: 'Could not save your reaction. Please try again.',
        variant: AppSnackbarVariant.error,
      );
    }
  } on DioException catch (e) {
    if (!context.mounted) return;
    final err = e.error;
    AppSnackbar.show(
      context,
      message: err is ApiException
          ? err.userMessage
          : 'Could not save your reaction. Please try again.',
      variant: AppSnackbarVariant.error,
    );
  } catch (_) {
    if (!context.mounted) return;
    AppSnackbar.show(
      context,
      message: 'Could not save your reaction. Please try again.',
      variant: AppSnackbarVariant.error,
    );
  }
}

/// Votes for one poll option, toast on transport failure. Results update via [_pollsStreamProvider].
Future<void> _votePoll(
  WidgetRef ref,
  BuildContext context, {
  required String activityId,
  required String pollId,
  required int optionIndex,
}) async {
  try {
    final voted = await ref
        .read(chatRepositoryProvider)
        .votePoll(
          activityId: activityId,
          pollId: pollId,
          optionIndex: optionIndex,
        );
    if (voted == null && context.mounted) {
      AppSnackbar.show(
        context,
        message: 'Could not save your vote. Please try again.',
        variant: AppSnackbarVariant.error,
      );
    }
  } on DioException catch (e) {
    if (!context.mounted) return;
    final err = e.error;
    AppSnackbar.show(
      context,
      message: err is ApiException
          ? err.userMessage
          : 'Could not save your vote. Please try again.',
      variant: AppSnackbarVariant.error,
    );
  } catch (_) {
    if (!context.mounted) return;
    AppSnackbar.show(
      context,
      message: 'Could not save your vote. Please try again.',
      variant: AppSnackbarVariant.error,
    );
  }
}

/// Renders the repository's "uploads unavailable" signal verbatim; every other photo failure keeps the generic copy.
String _photoErrorMessage(Object e) {
  const unavailable = 'Photo uploads are unavailable right now';
  if (e is ImageTooLargeException) return e.message;
  if (e.toString().contains(unavailable)) return unavailable;
  return 'Could not send photo.';
}

/// Local per-chat mute (no backend support — a string list of muted activity ids under [mutedChatsKey]).
Future<bool> isChatMuted(String activityId) async {
  try {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getStringList(mutedChatsKey)?.contains(activityId) ?? false;
  } catch (_) {
    return false;
  }
}

/// Persists a mute toggle. Never throws (safe to call unawaited).
Future<void> setChatMuted(String activityId, bool muted) async {
  try {
    final prefs = await SharedPreferences.getInstance();
    final current = prefs.getStringList(mutedChatsKey) ?? const <String>[];
    final next = current.where((id) => id != activityId).toList();
    if (muted) next.add(activityId);
    await prefs.setStringList(mutedChatsKey, next);
  } catch (_) {}
}

/// Opens a chat sender's profile from an avatar or name tap.
void _openSenderProfile(BuildContext context, String senderId) {
  final uid = senderId.trim();
  if (uid.isEmpty) return;
  NavGuard.push(context, '/player-profile/uid/$uid');
}

/// Fetches the activity for the chat header.
final _activityProvider = FutureProvider.autoDispose
    .family<ActivityModel?, String>((ref, id) {
      return ref.watch(activityRepositoryProvider).byId(id);
    });

/// Fetches the participant roster for the chat.
final _participantsProvider = FutureProvider.autoDispose
    .family<List<ActivityParticipant>, String>((ref, activityId) {
      return ref.watch(activityRepositoryProvider).participants(activityId);
    });

/// Polls `GET /api/typing/:activityId/:uid` for every member of the chat and emits the subset that's currently typing.
/// [otherUids] is the list of participants *excluding* the current user.
/// Keyed on a record `(activityId, otherUids)` so the cache is re-used when only the input list changes.
final _typingUidsProvider = StreamProvider.autoDispose
    .family<Set<String>, ({String activityId, List<String> otherUids})>((
      ref,
      args,
    ) {
      return ref
          .watch(typingRepositoryProvider)
          .watchTyping(activityId: args.activityId, uids: args.otherUids);
    });

// Screen.

class ChatScreen extends ConsumerStatefulWidget {
  /// Backend activity id — the screen uses this to look up the activity.
  const ChatScreen({super.key, required this.activityId});
  final String activityId;

  @override
  ConsumerState<ChatScreen> createState() => _ChatScreenState();
}

class _ChatScreenState extends ConsumerState<ChatScreen> {
  final _msgController = TextEditingController();
  final _scrollController = ScrollController();
  final _focusNode = FocusNode();
  bool _hasText = false;

  /// Tracks whether we've already announced `_id` as "I'm typing" to the backend.
  bool _isAnnouncedTyping = false;

  /// Debounce timer for the "I'm typing" announcement.
  Timer? _typingDebounce;

  /// Stops the typing announcement after 3s of no further keystrokes.
  Timer? _typingStopTimer;

  String get _id => widget.activityId;

  /// How long after the last keystroke to keep the typing indicator alive before automatically clearing it.
  static const Duration _typingStopAfter = Duration(seconds: 3);

  /// Debounce before announcing "I'm typing" to the backend.
  static const Duration _typingDebounceAfter = Duration(milliseconds: 500);

  @override
  void initState() {
    super.initState();
    // Capture the typing repository before any dispose can happen.
    _typingRepo = ref.read(typingRepositoryProvider);
    _msgController.addListener(_onInputChanged);
    // Baseline for the inbox unread badge: opening the chat marks everything up to now as seen.
    unawaited(recordChatOpened(_id));
  }

  TypingRepository? _typingRepo;

  @override
  void dispose() {
    _typingDebounce?.cancel();
    _typingStopTimer?.cancel();
    _msgController.removeListener(_onInputChanged);
    _msgController.dispose();
    _scrollController.dispose();
    _focusNode.dispose();
    // Best-effort: clear the typing row when leaving the chat.
    final repo = _typingRepo;
    if (repo != null) {
      unawaited(repo.setTyping(activityId: _id, isTyping: false));
    }
    super.dispose();
  }

  /// Called on every keystroke.
  void _onInputChanged() {
    final has = _msgController.text.trim().isNotEmpty;
    if (has != _hasText) {
      // Only `setState` when the visible "send button enabled" state actually changes — not on every keystroke.
      setState(() => _hasText = has);
    }
    if (!has) {
      // Field emptied (either sent or backspaced) → stop the announcement immediately.
      _typingDebounce?.cancel();
      _typingStopTimer?.cancel();
      if (_isAnnouncedTyping) {
        _isAnnouncedTyping = false;
        unawaited(
          ref
              .read(typingRepositoryProvider)
              .setTyping(activityId: _id, isTyping: false),
        );
      }
      return;
    }

    // Schedule a "start typing" announcement if we haven't already.
    if (!_isAnnouncedTyping) {
      _typingDebounce?.cancel();
      _typingDebounce = Timer(_typingDebounceAfter, () {
        if (!mounted) return;
        if (!_isAnnouncedTyping && _msgController.text.trim().isNotEmpty) {
          _isAnnouncedTyping = true;
          unawaited(
            ref
                .read(typingRepositoryProvider)
                .setTyping(activityId: _id, isTyping: true),
          );
        }
      });
    }

    // (Re)arm the auto-stop timer — if the user pauses for 3s, the server should know they stopped.
    _typingStopTimer?.cancel();
    _typingStopTimer = Timer(_typingStopAfter, () {
      if (!mounted) return;
      if (_isAnnouncedTyping) {
        _isAnnouncedTyping = false;
        unawaited(
          ref
              .read(typingRepositoryProvider)
              .setTyping(activityId: _id, isTyping: false),
        );
      }
    });
  }

  Future<void> _send() async {
    final text = _msgController.text.trim();
    if (text.isEmpty) return;
    // Local archive guard: the backend 403s anyway.
    final activity = ref.read(_activityProvider(widget.activityId)).valueOrNull;
    if (activity?.isChatArchived ?? false) {
      if (!mounted) return;
      AppSnackbar.show(
        context,
        message: 'Chat is archived',
        variant: AppSnackbarVariant.error,
      );
      return;
    }
    HapticFeedback.lightImpact();
    _msgController.clear();
    // Stop the typing indicator immediately — the message itself proves the user finished typing.
    _typingDebounce?.cancel();
    _typingStopTimer?.cancel();
    if (_isAnnouncedTyping) {
      _isAnnouncedTyping = false;
      unawaited(
        ref
            .read(typingRepositoryProvider)
            .setTyping(activityId: _id, isTyping: false),
      );
    }
    try {
      await ref.read(chatRepositoryProvider).send(activityId: _id, text: text);
      // The new RTDB / polling listener will pick up the message automatically — no invalidate needed.
      _scrollToBottom();
    } on DioException catch (e) {
      if (!mounted) return;
      // Restore the draft so the user doesn't lose what they typed.
      _msgController.text = text;
      final err = e.error;
      AppSnackbar.show(
        context,
        message: err is ApiException
            ? err.userMessage
            : 'Could not send message. Check your connection and try again.',
        variant: AppSnackbarVariant.error,
      );
    } catch (_) {
      if (!mounted) return;
      // Restore the draft so the user doesn't lose what they typed.
      _msgController.text = text;
      AppSnackbar.show(
        context,
        message: 'Could not send message. Check your connection and try again.',
        variant: AppSnackbarVariant.error,
      );
    }
  }

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scrollController.hasClients) {
        _scrollController.animateTo(
          _scrollController.position.maxScrollExtent + 80,
          duration: AppDurations.base,
          curve: Curves.easeOut,
        );
      }
    });
  }

  Future<void> _openAttachmentSheet() async {
    final choice = await ChatAttachmentSheet.show(context);
    if (choice == null || !mounted) return;
    switch (choice) {
      case ChatAttachmentChoice.photo:
        await _pickAndSendImage(ImageSource.gallery);
      case ChatAttachmentChoice.camera:
        await _pickAndSendImage(ImageSource.camera);
      case ChatAttachmentChoice.location:
        await _shareLocation();
      case ChatAttachmentChoice.poll:
        await _openPollCreateSheet();
    }
  }

  Future<void> _openPollCreateSheet() async {
    final created = await PollCreateSheet.show(context, activityId: _id);
    if (created == true && mounted) {
      AppSnackbar.show(
        context,
        message: 'Poll created. Time to vote!',
        variant: AppSnackbarVariant.success,
      );
      _scrollToBottom();
    }
  }

  Future<void> _pickAndSendImage(ImageSource source) async {
    final XFile? picked;
    try {
      picked = await ImagePicker().pickImage(
        source: source,
        maxWidth: 1600,
        imageQuality: 85,
      );
    } on PlatformException {
      // Permission denied (or no camera on the device).
      if (!mounted) return;
      AppSnackbar.show(
        context,
        message: source == ImageSource.camera
            ? 'Could not access the camera. Check camera permissions and try again.'
            : 'Could not access your photos. Check photo permissions and try again.',
        variant: AppSnackbarVariant.error,
      );
      return;
    } catch (_) {
      if (!mounted) return;
      AppSnackbar.show(
        context,
        message: 'Could not attach a photo. Please try again.',
        variant: AppSnackbarVariant.error,
      );
      return;
    }
    if (picked == null || !mounted) return;
    HapticFeedback.lightImpact();
    try {
      await ref
          .read(chatRepositoryProvider)
          .sendImage(activityId: _id, imagePath: picked.path);
      // New message will arrive via the RTDB / polling stream.
      _scrollToBottom();
    } catch (e) {
      if (!mounted) return;
      AppSnackbar.show(
        context,
        // The "uploads unavailable" signal renders verbatim; every other failure keeps the generic copy.
        message: _photoErrorMessage(e),
        variant: AppSnackbarVariant.error,
      );
    }
  }

  Future<void> _shareLocation() async {
    late final Position? position;
    try {
      position = await LocationService.instance.getCurrentLocation();
    } on LocationTimeoutException {
      // A slow fix is transient — offer a retry, not a lecture about permissions.
      if (!mounted) return;
      AppSnackbar.show(
        context,
        message: "Couldn't get your location. Try again.",
        variant: AppSnackbarVariant.error,
      );
      return;
    }
    if (!mounted) return;
    if (position == null) {
      // Permanently denied ("don't ask again") can only be fixed in the OS settings — offer a shortcut there.
      final permanentlyDenied = await LocationService.instance
          .isPermissionPermanentlyDenied();
      if (!mounted) return;
      AppSnackbar.show(
        context,
        message: permanentlyDenied
            ? 'Location permission is off. Enable it in Settings to share your location.'
            : 'Could not access your location. Check location '
                  'permissions and try again.',
        variant: AppSnackbarVariant.error,
        actionLabel: permanentlyDenied ? 'Open Settings' : null,
        onAction: permanentlyDenied ? () => Geolocator.openAppSettings() : null,
      );
      return;
    }
    HapticFeedback.lightImpact();
    try {
      await ref
          .read(chatRepositoryProvider)
          .sendLocation(
            activityId: _id,
            latitude: position.latitude,
            longitude: position.longitude,
          );
      // New message will arrive via the RTDB / polling stream.
      _scrollToBottom();
    } catch (_) {
      if (!mounted) return;
      AppSnackbar.show(
        context,
        message: 'Could not share your location.',
        variant: AppSnackbarVariant.error,
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    // Fetch the activity once on first build to get the title for the header.
    final activityAsync = ref.watch(_activityProvider(widget.activityId));
    final title = activityAsync.valueOrNull?.title ?? 'Chat';
    // Archived threads are read-only: the backend 403s every write.
    final isArchived = activityAsync.valueOrNull?.isChatArchived ?? false;

    return AnnotatedRegion<SystemUiOverlayStyle>(
      // White status-bar icons on the navy header.
      value: const SystemUiOverlayStyle(
        statusBarColor: Colors.transparent,
        statusBarIconBrightness: Brightness.light,
        statusBarBrightness: Brightness.dark,
      ),
      child: AppScaffold(
        safeAreaTop: false,
        showHomeIndicator: false,
        backgroundColor: context.colors.background,
        body: Column(
          children: [
            Container(
              // Flat navy matching the header gradient's top edge.
              color: _chatHeaderNavyTop,
              child: SafeArea(
                bottom: false,
                child: _Header(
                  title: title,
                  activityId: widget.activityId,
                  activity: activityAsync.valueOrNull,
                ),
              ),
            ),
            _MatchBanner(
              activityAsync: activityAsync,
              onRetry: () =>
                  ref.invalidate(_activityProvider(widget.activityId)),
            ),
            Expanded(
              child: _MessageList(
                id: _id,
                scrollController: _scrollController,
                isArchived: isArchived,
              ),
            ),
            _InputBar(
              controller: _msgController,
              focusNode: _focusNode,
              hasText: _hasText,
              onSend: _send,
              onAttach: () {
                if (isArchived) {
                  AppSnackbar.show(
                    context,
                    message: 'Chat is archived',
                    variant: AppSnackbarVariant.error,
                  );
                  return;
                }
                _openAttachmentSheet();
              },
              isArchived: isArchived,
            ),
          ],
        ),
      ),
    );
  }
}

// Header.

/// Navy lift at the top edge of the chat header gradient.
const _chatHeaderNavyTop = Color(0xFF1B2BA3);
