part of '../chat_screen.dart';

class _ChatImage extends StatelessWidget {
  const _ChatImage({
    required this.msg,
    required this.width,
    required this.height,
    this.fit = BoxFit.cover,
  });
  final ChatMessage msg;
  final double width;
  final double height;
  final BoxFit fit;

  @override
  Widget build(BuildContext context) {
    final localPath = msg.imagePath;
    if (localPath != null) {
      return Image.file(
        File(localPath),
        width: width,
        height: height,
        fit: fit,
        errorBuilder: (_, _, _) => _brokenImage(context),
      );
    }
    final remoteUrl = msg.imageUrl;
    if (remoteUrl == null) return _brokenImage(context);
    return CachedNetworkImage(
      imageUrl: remoteUrl,
      width: width,
      height: height,
      fit: fit,
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
        debugPrint('[ChatImage] failed: $url ($error)');
        return _brokenImage(context);
      },
    );
  }

  Widget _brokenImage(BuildContext context) {
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

/// Full-screen photo viewer behind a bubble tap: pinch-to-zoom via [InteractiveViewer], dark scrim, and a close button.

class _ChatImageViewer extends StatelessWidget {
  const _ChatImageViewer({required this.msg});
  final ChatMessage msg;

  static Future<void> show(BuildContext context, ChatMessage msg) {
    return showDialog<void>(
      context: context,
      barrierColor: Colors.black87,
      builder: (_) => _ChatImageViewer(msg: msg),
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
              minScale: 1,
              maxScale: 4,
              child: _ChatImage(
                msg: msg,
                width: screen.width,
                height: screen.height * 0.8,
                fit: BoxFit.contain,
              ),
            ),
          ),
          Positioned(
            top: MediaQuery.of(context).viewPadding.top + 8,
            right: 16,
            child: Semantics(
              button: true,
              label: 'Close photo',
              child: PressableScale(
                onTap: () => Navigator.of(context).pop(),
                child: Container(
                  width: 40,
                  height: 40,
                  decoration: const BoxDecoration(
                    color: Colors.black54,
                    shape: BoxShape.circle,
                  ),
                  alignment: Alignment.center,
                  child: const Icon(
                    Icons.close_rounded,
                    color: Colors.white,
                    size: 22,
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _LocationBubble extends StatelessWidget {
  const _LocationBubble({required this.msg, required this.isMine});
  final ChatMessage msg;
  final bool isMine;

  Future<void> _open(BuildContext context) async {
    final uri = Uri.parse(
      'https://www.google.com/maps/search/?api=1&query=${msg.latitude},${msg.longitude}',
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
    final fg = isMine ? AppColors.textOnPrimary : context.colors.textPrimary;
    return PressableScale(
      onTap: () => _open(context),
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
}

// Input bar.
