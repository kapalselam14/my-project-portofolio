import 'dart:io';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../core/providers/repository_providers.dart';
import '../../../core/services/location_service.dart';
import '../../../core/services/storage_service.dart';
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
import '../../profile/domain/user_model.dart';
import '../../report/presentation/report_user_sheet.dart';
import '../domain/chat_message.dart';
import 'chat_attachment_sheet.dart';

part 'widgets/dm_header.dart';
part 'widgets/dm_bubble.dart';
part 'widgets/dm_composer.dart';
part 'widgets/dm_settings.dart';

/// Peer profile for the avatar (best-effort.
final _peerProfileProvider = FutureProvider.autoDispose
    .family<UserModel?, String>((ref, uid) {
      return ref.watch(userRepositoryProvider).byId(uid);
    });

/// Minimal 1-on-1 direct-message thread.
/// Peer name header, realtime bubble list (text, photos, shared locations), composer with photo/location.
class DmScreen extends ConsumerStatefulWidget {
  const DmScreen({super.key, required this.otherUid, this.peerName});

  /// The other participant's uid (route path parameter).
  final String otherUid;

  /// Display name passed via route `extra` — falls back to a generic label when absent.
  final String? peerName;

  @override
  ConsumerState<DmScreen> createState() => _DmScreenState();
}

class _DmScreenState extends ConsumerState<DmScreen> {
  final _controller = TextEditingController();
  final _scroll = ScrollController();
  final _focusNode = FocusNode();
  bool _sending = false;
  bool _hasText = false;
  String? _errorText;

  @override
  void initState() {
    super.initState();
    _controller.addListener(_onTextChanged);
    // Clear the badge right away (fire-and-forget); the inbox list refreshes underneath via its RTDB watch.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      ref.read(dmRepositoryProvider).markRead(widget.otherUid);
    });
  }

  void _onTextChanged() {
    final hasText = _controller.text.trim().isNotEmpty;
    if (hasText != _hasText && mounted) {
      setState(() {
        _hasText = hasText;
        if (hasText) _errorText = null;
      });
    }
  }

  @override
  void dispose() {
    _controller.removeListener(_onTextChanged);
    _controller.dispose();
    _focusNode.dispose();
    _scroll.dispose();
    super.dispose();
  }

  Future<void> _send() async {
    final text = _controller.text.trim();
    debugPrint(
      '[DmScreen] send tapped (len=${text.length}, sending=$_sending)',
    );
    if (text.isEmpty || _sending) return;
    setState(() {
      _sending = true;
      _errorText = null;
    });
    _controller.clear();
    try {
      final msg = await ref
          .read(dmRepositoryProvider)
          .send(otherUid: widget.otherUid, text: text);
      debugPrint('[DmScreen] sent id=${msg.id}');
      if (!mounted) return;
      setState(() => _errorText = null);
      _scrollToLatest();
    } catch (e) {
      debugPrint('[DmScreen] send failed: $e');
      if (!mounted) return;
      // Restore the draft so the user doesn't lose what they typed (mirrors the group chat send path).
      _controller.text = text;
      setState(() {
        _errorText = 'Could not send. Tap send to retry.';
      });
      AppSnackbar.show(
        context,
        message: 'Could not send. Please try again.',
        variant: AppSnackbarVariant.error,
      );
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  void _scrollToLatest() {
    // ListView is reversed: offset 0 is the newest message.
    if (_scroll.hasClients) {
      _scroll.animateTo(
        0,
        duration: const Duration(milliseconds: 250),
        curve: Curves.easeOut,
      );
    }
  }

  Future<void> _openAttachmentSheet() async {
    // Polls live under activity group chats — hidden in 1-on-1 threads.
    final choice = await ChatAttachmentSheet.show(context, includePoll: false);
    if (choice == null || !mounted) return;
    switch (choice) {
      case ChatAttachmentChoice.photo:
        await _pickAndSendImage(ImageSource.gallery);
      case ChatAttachmentChoice.camera:
        await _pickAndSendImage(ImageSource.camera);
      case ChatAttachmentChoice.location:
        await _shareLocation();
      case ChatAttachmentChoice.poll:
        break;
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
          .read(dmRepositoryProvider)
          .sendImage(otherUid: widget.otherUid, imagePath: picked.path);
      if (!mounted) return;
      _scrollToLatest();
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
          .read(dmRepositoryProvider)
          .sendLocation(
            otherUid: widget.otherUid,
            latitude: position.latitude,
            longitude: position.longitude,
          );
      if (!mounted) return;
      _scrollToLatest();
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
    final stream = ref
        .watch(dmRepositoryProvider)
        .watchMessages(widget.otherUid);
    // Peer identity resolves in order: live profile → route extra → generic fallback.
    final peer = ref.watch(_peerProfileProvider(widget.otherUid)).valueOrNull;
    final peerName = (peer?.displayName.isNotEmpty == true)
        ? peer!.displayName
        : (widget.peerName ?? 'Direct message');
    final peerPhotoUrl = peer?.avatarUrl;

    return AnnotatedRegion<SystemUiOverlayStyle>(
      // Same treatment as the group chat header: white status-bar icons on navy, auto-restored when leaving this.
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
              color: _dmHeaderNavyTop,
              child: SafeArea(
                bottom: false,
                child: _DmHeader(
                  peerUid: widget.otherUid,
                  peerName: peerName,
                  peerPhotoUrl: peerPhotoUrl,
                ),
              ),
            ),
            Expanded(
              child: StreamBuilder<List<ChatMessage>>(
                stream: stream,
                builder: (context, snapshot) {
                  if (snapshot.hasError) {
                    return ErrorRetry(
                      message: 'Could not load messages.',
                      // The stream is recreated on rebuild, so a plain setState retries the subscription.
                      onRetry: () => setState(() {}),
                    );
                  }
                  if (snapshot.connectionState == ConnectionState.waiting &&
                      !snapshot.hasData) {
                    return const Center(child: CircularProgressIndicator());
                  }
                  final messages = snapshot.data ?? const <ChatMessage>[];
                  if (messages.isEmpty) {
                    return Center(
                      child: Text(
                        'Say hi to start the conversation.',
                        style: AppTypography.metaSub(context),
                      ),
                    );
                  }
                  return ListView.builder(
                    controller: _scroll,
                    reverse: true,
                    padding: const EdgeInsets.symmetric(
                      horizontal: AppSpacing.x4,
                      vertical: AppSpacing.x3,
                    ),
                    itemCount: messages.length,
                    itemBuilder: (_, i) {
                      final m = messages[messages.length - 1 - i];
                      return _DmBubble(
                        message: m,
                        peerName: peerName,
                        peerPhotoUrl: peerPhotoUrl,
                      );
                    },
                  );
                },
              ),
            ),
            if (_errorText != null)
              Padding(
                padding: const EdgeInsets.fromLTRB(
                  AppSpacing.x5,
                  AppSpacing.x2,
                  AppSpacing.x5,
                  0,
                ),
                child: Text(
                  _errorText!,
                  style: AppTypography.metaSub(
                    context,
                  ).copyWith(color: context.colors.errorText),
                ),
              ),
            _Composer(
              controller: _controller,
              focusNode: _focusNode,
              hasText: _hasText,
              sending: _sending,
              onSend: _send,
              onAttach: _openAttachmentSheet,
            ),
          ],
        ),
      ),
    );
  }
}

/// Navy lift at the top edge of the DM header gradient.
const _dmHeaderNavyTop = Color(0xFF1B2BA3);
