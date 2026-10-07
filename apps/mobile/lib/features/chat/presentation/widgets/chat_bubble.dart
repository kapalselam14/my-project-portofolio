part of '../chat_screen.dart';

class _Bubble extends StatelessWidget {
  const _Bubble({
    required this.item,
    this.reactions = const <String, List<String>>{},
    this.myUid = '',
    this.onReact,
  });
  final _MessageItem item;
  final EmojiReactions reactions;
  final String myUid;
  final ValueChanged<String>? onReact;

  String _formatTime(DateTime dt) {
    final h = dt.hour > 12 ? dt.hour - 12 : (dt.hour == 0 ? 12 : dt.hour);
    final m = dt.minute.toString().padLeft(2, '0');
    return '$h:$m ${dt.hour < 12 ? 'AM' : 'PM'}';
  }

  @override
  Widget build(BuildContext context) {
    final msg = item.message;
    final isMine = msg.isMine;
    final maxW = MediaQuery.of(context).size.width * 0.72;
    final bottomGap = item.isLastOfRun ? AppSpacing.x4 : 3.0;

    // System events ("Sam left the group") render as a centered grey pill.
    if (msg.isSystem) {
      return Padding(
        padding: EdgeInsets.only(bottom: bottomGap),
        child: Center(
          child: Container(
            constraints: BoxConstraints(maxWidth: maxW),
            padding: const EdgeInsets.symmetric(
              horizontal: AppSpacing.x3,
              vertical: AppSpacing.x2,
            ),
            decoration: BoxDecoration(
              color: context.colors.surfaceMuted,
              borderRadius: BorderRadius.circular(AppRadius.pill),
            ),
            child: Text(
              msg.text,
              textAlign: TextAlign.center,
              style: AppTypography.metaSub(
                context,
              ).copyWith(color: context.colors.textSecondary),
            ),
          ),
        ),
      );
    }

    return Padding(
      padding: EdgeInsets.only(bottom: bottomGap),
      child: Column(
        crossAxisAlignment: isMine
            ? CrossAxisAlignment.end
            : CrossAxisAlignment.start,
        children: [
          // Sender name — above first bubble of a run (others only).
          if (item.showSenderName)
            Padding(
              padding: const EdgeInsets.only(left: 44, bottom: 4),
              child: GestureDetector(
                onTap: () => _openSenderProfile(context, msg.senderId),
                behavior: HitTestBehavior.opaque,
                child: Text(
                  msg.senderName,
                  style: AppTypography.metaSub(context).copyWith(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    color: context.colors.textSecondary,
                  ),
                ),
              ),
            ),

          Row(
            mainAxisAlignment: isMine
                ? MainAxisAlignment.end
                : MainAxisAlignment.start,
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              // Avatar column (others only) — tappable to the profile.
              if (!isMine) ...[
                SizedBox(
                  width: 36,
                  child: item.showAvatar
                      ? Semantics(
                          button: true,
                          label: 'View ${msg.senderName} profile',
                          child: GestureDetector(
                            onTap: () =>
                                _openSenderProfile(context, msg.senderId),
                            child: AppAvatar(
                              imageUrl: msg.senderAvatarUrl,
                              assetPath: msg.senderAvatarAsset,
                              name: msg.senderName,
                              size: AppAvatarSize.sm,
                            ),
                          ),
                        )
                      : null,
                ),
                const SizedBox(width: AppSpacing.x2),
              ],

              // Bubble — long-press opens the reaction picker.
              Flexible(
                child: GestureDetector(
                  onLongPress: onReact == null
                      ? null
                      : () => _ReactionPickerSheet.show(
                          context,
                          onPick: onReact!,
                        ),
                  child: Container(
                    constraints: BoxConstraints(maxWidth: maxW),
                    padding: msg.isImage
                        ? const EdgeInsets.all(4)
                        : const EdgeInsets.symmetric(
                            horizontal: AppSpacing.x4,
                            vertical: AppSpacing.x3,
                          ),
                    decoration: BoxDecoration(
                      color: isMine
                          ? AppColors.primary
                          : context.colors.surface,
                      borderRadius: BorderRadius.only(
                        topLeft: const Radius.circular(AppRadius.lg),
                        topRight: const Radius.circular(AppRadius.lg),
                        bottomLeft: Radius.circular(
                          isMine || !item.isLastOfRun ? AppRadius.lg : 4,
                        ),
                        bottomRight: Radius.circular(
                          !isMine || !item.isLastOfRun ? AppRadius.lg : 4,
                        ),
                      ),
                      boxShadow: isMine ? null : AppShadows.card,
                    ),
                    child: _BubbleContent(msg: msg, isMine: isMine),
                  ),
                ),
              ),
            ],
          ),

          // Reaction chips — below the bubble, above the timestamp.
          if (reactions.isNotEmpty)
            Padding(
              padding: EdgeInsets.only(
                top: 4,
                left: isMine ? 0 : 46,
                right: isMine ? 2 : 0,
              ),
              child: _ReactionChips(
                reactions: reactions,
                myUid: myUid,
                onToggle: onReact,
              ),
            ),

          // Timestamp — below last bubble of run
          if (item.isLastOfRun)
            Padding(
              padding: EdgeInsets.only(
                top: 4,
                left: isMine ? 0 : 46,
                right: isMine ? 2 : 0,
              ),
              child: Text(
                _formatTime(msg.sentAt),
                style: AppTypography.metaSub(
                  context,
                ).copyWith(fontSize: 11, color: context.colors.textTertiary),
              ),
            ),
        ],
      ),
    );
  }
}

// Bubble content (text image location).

/// Renders the payload inside a chat bubble.
/// Photos resolve local-first: a just-sent message renders from disk via [ChatMessage.imagePath].

class _BubbleContent extends StatelessWidget {
  const _BubbleContent({required this.msg, required this.isMine});
  final ChatMessage msg;
  final bool isMine;

  @override
  Widget build(BuildContext context) {
    if (msg.isImage) {
      // Defensive: isImage means an image source exists, but guard anyway.
      if (msg.imageUrl == null && msg.imagePath == null) {
        return _bubbleText(context);
      }
      return PressableScale(
        onTap: () => _ChatImageViewer.show(context, msg),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(AppRadius.md),
          child: _ChatImage(msg: msg, width: 200, height: 200),
        ),
      );
    }

    if (msg.isLocation) {
      return _LocationBubble(msg: msg, isMine: isMine);
    }

    return _bubbleText(context);
  }

  /// Plain-text bubble.
  Widget _bubbleText(BuildContext context) {
    return SelectableText(
      msg.text,
      style: AppTypography.bodyReading(context).copyWith(
        color: isMine ? AppColors.textOnPrimary : context.colors.textPrimary,
      ),
    );
  }
}

// Reactions.

/// Bottom sheet behind a bubble long-press: one tap toggles that emoji reaction for the current user.
