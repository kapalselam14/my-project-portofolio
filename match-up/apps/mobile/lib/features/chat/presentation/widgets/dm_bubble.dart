part of '../dm_screen.dart';

class _DmBubble extends StatelessWidget {
  const _DmBubble({
    required this.message,
    required this.peerName,
    required this.peerPhotoUrl,
  });
  final ChatMessage message;
  final String peerName;
  final String? peerPhotoUrl;

  @override
  Widget build(BuildContext context) {
    final mine = message.isMine;
    final bubble = Align(
      alignment: mine ? Alignment.centerRight : Alignment.centerLeft,
      child: Column(
        crossAxisAlignment: mine
            ? CrossAxisAlignment.end
            : CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Flexible(
            flex: 0,
            child: Container(
              margin: const EdgeInsets.symmetric(vertical: 3),
              padding: message.isImage || message.isLocation
                  ? const EdgeInsets.all(4)
                  : const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
              constraints: BoxConstraints(
                maxWidth: MediaQuery.of(context).size.width * 0.72,
              ),
              decoration: BoxDecoration(
                color: mine ? AppColors.primary : context.colors.surface,
                borderRadius: BorderRadius.circular(AppRadius.card),
                border: mine ? null : Border.all(color: context.colors.border),
              ),
              child: _DmBubbleContent(message: message, isMine: mine),
            ),
          ),
          Padding(
            padding: EdgeInsets.only(
              left: mine ? 0 : 4,
              right: mine ? 4 : 0,
              bottom: 2,
            ),
            child: Text(
              _dmTime(message.sentAt),
              style: AppTypography.metaSub(
                context,
              ).copyWith(fontSize: 11, color: context.colors.textTertiary),
            ),
          ),
        ],
      ),
    );
    if (mine) return bubble;
    // Peer's avatar alongside their messages (group-chat parity).
    return Row(
      crossAxisAlignment: CrossAxisAlignment.end,
      children: [
        Padding(
          padding: const EdgeInsets.only(right: 8, bottom: 18),
          child: AppAvatar(
            imageUrl: peerPhotoUrl,
            name: peerName,
            size: AppAvatarSize.xs,
          ),
        ),
        Flexible(child: bubble),
      ],
    );
  }
}

/// Renders a DM bubble's payload — plain text by default, or a photo / location attachment when the message carries.

/// Renders a DM bubble's payload — plain text by default, or a photo / location attachment when the message carries.
class _DmBubbleContent extends StatelessWidget {
  const _DmBubbleContent({required this.message, required this.isMine});
  final ChatMessage message;
  final bool isMine;

  Future<void> _openLocation(BuildContext context) async {
    final uri = Uri.parse(
      'https://www.google.com/maps/search/?api=1&query=${message.latitude},${message.longitude}',
    );
    final opened = await launchUrl(uri, mode: LaunchMode.externalApplication);
    if (!opened && context.mounted) {
      AppSnackbar.show(
        context,
        message: 'Could not open Maps',
        variant: AppSnackbarVariant.error,
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    if (message.isImage) {
      // Defensive: isImage means an image source exists, but guard anyway.
      if (message.imageUrl == null && message.imagePath == null) {
        return _DmText(message: message, isMine: isMine);
      }
      return PressableScale(
        onTap: () => _DmImageViewer.show(context, message),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(AppRadius.md),
          child: _DmImage(message: message, width: 200, height: 200),
        ),
      );
    }

    if (message.isLocation) {
      final fg = isMine ? AppColors.textOnPrimary : context.colors.textPrimary;
      return PressableScale(
        onTap: () => _openLocation(context),
        child: SizedBox(
          width: 180,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.location_on_rounded, color: fg, size: 28),
              const SizedBox(height: AppSpacing.x2),
              Text(
                'My Location',
                style: AppTypography.labelField(context).copyWith(color: fg),
              ),
              const SizedBox(height: 2),
              Text(
                'Tap to open in Maps',
                style: AppTypography.metaSub(
                  context,
                ).copyWith(color: fg.withValues(alpha: 0.75)),
              ),
            ],
          ),
        ),
      );
    }

    return _DmText(message: message, isMine: isMine);
  }
}

/// Plain-text DM bubble, also the fallback when an image message carries no usable image source.

/// Plain-text DM bubble, also the fallback when an image message carries no usable image source.
class _DmText extends StatelessWidget {
  const _DmText({required this.message, required this.isMine});
  final ChatMessage message;
  final bool isMine;

  @override
  Widget build(BuildContext context) {
    return SelectableText(
      message.text,
      style: AppTypography.bodyMedium(context).copyWith(
        color: isMine ? AppColors.textOnPrimary : context.colors.textPrimary,
      ),
    );
  }
}

/// Single DM photo — local file when just captured, network image otherwise.

/// Single DM photo — local file when just captured, network image otherwise.
class _DmImage extends StatelessWidget {
  const _DmImage({
    required this.message,
    required this.width,
    required this.height,
  });
  final ChatMessage message;
  final double width;
  final double height;

  @override
  Widget build(BuildContext context) {
    final localPath = message.imagePath;
    if (localPath != null) {
      return Image.file(
        File(localPath),
        width: width,
        height: height,
        fit: BoxFit.cover,
        errorBuilder: (_, _, _) => _brokenDmImage(context),
      );
    }
    final remoteUrl = message.imageUrl;
    if (remoteUrl == null) return _brokenDmImage(context);
    return CachedNetworkImage(
      imageUrl: remoteUrl,
      width: width,
      height: height,
      fit: BoxFit.cover,
      memCacheWidth: (width * MediaQuery.devicePixelRatioOf(context))
          .round()
          .clamp(1, 1200),
      fadeInDuration: const Duration(milliseconds: 150),
      fadeOutDuration: Duration.zero,
      progressIndicatorBuilder: (context, url, progress) => Container(
        width: width,
        height: height,
        color: context.colors.surfaceMuted,
        alignment: Alignment.center,
        child: const SizedBox(
          width: 24,
          height: 24,
          child: CircularProgressIndicator(strokeWidth: 2),
        ),
      ),
      errorWidget: (context, url, error) {
        debugPrint('[DmImage] failed: $url ($error)');
        return _brokenDmImage(context);
      },
    );
  }

  Widget _brokenDmImage(BuildContext context) {
    return Container(
      width: width,
      height: height,
      color: context.colors.surfaceMuted,
      alignment: Alignment.center,
      child: Icon(
        Icons.broken_image_outlined,
        color: context.colors.textTertiary,
      ),
    );
  }
}

/// Full-screen DM photo viewer: pinch-to-zoom, dark scrim, close button.

/// Full-screen DM photo viewer: pinch-to-zoom, dark scrim, close button.
class _DmImageViewer extends StatelessWidget {
  const _DmImageViewer({required this.message});
  final ChatMessage message;

  static Future<void> show(BuildContext context, ChatMessage message) {
    return showDialog<void>(
      context: context,
      barrierColor: Colors.black87,
      builder: (_) => _DmImageViewer(message: message),
    );
  }

  @override
  Widget build(BuildContext context) {
    final screen = MediaQuery.of(context).size;
    return Dialog(
      backgroundColor: Colors.transparent,
      insetPadding: EdgeInsets.zero,
      child: Stack(
        children: [
          Center(
            child: InteractiveViewer(
              child: _DmImage(
                message: message,
                width: screen.width,
                height: screen.height * 0.7,
              ),
            ),
          ),
          Positioned(
            top: MediaQuery.of(context).padding.top + 8,
            right: 16,
            child: Semantics(
              button: true,
              label: 'Close viewer',
              child: PressableScale(
                onTap: () => Navigator.of(context).pop(),
                child: Container(
                  width: 38,
                  height: 38,
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.14),
                    shape: BoxShape.circle,
                    border: Border.all(
                      color: Colors.white.withValues(alpha: 0.28),
                    ),
                  ),
                  child: const Icon(Icons.close_rounded, color: Colors.white),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Renders the repository's "uploads unavailable" and "too large" signals verbatim.
String _photoErrorMessage(Object e) {
  const unavailable = 'Photo uploads are unavailable right now';
  if (e is ImageTooLargeException) return e.message;
  if (e.toString().contains(unavailable)) return unavailable;
  return 'Could not send photo.';
}

/// 'h:mm a' without pulling intl in for one label.
String _dmTime(DateTime dt) {
  final h24 = dt.hour;
  final h = h24 % 12 == 0 ? 12 : h24 % 12;
  final m = dt.minute.toString().padLeft(2, '0');
  return '$h:$m ${h24 < 12 ? 'AM' : 'PM'}';
}

/// Message composer mirroring the group chat.
