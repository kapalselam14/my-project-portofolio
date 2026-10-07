part of '../joined_activity_detail_screen.dart';

class _ChatSection extends StatelessWidget {
  const _ChatSection({required this.messages, required this.activityId});
  final List<ChatMessage> messages;
  final String activityId;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('Group Chat', style: AppTypography.titleMedium(context)),
        const SizedBox(height: AppSpacing.x3),
        Container(
          padding: const EdgeInsets.all(AppSpacing.x4),
          decoration: BoxDecoration(
            color: context.colors.surface,
            borderRadius: BorderRadius.circular(AppRadius.card),
            border: Border.all(color: context.colors.border),
            boxShadow: AppShadows.card,
          ),
          child: Column(
            children: [
              for (final msg in messages) ...[
                _ChatMsgRow(message: msg),
                const SizedBox(height: AppSpacing.x3),
              ],
              // Open Chat button
              PressableScale(
                onTap: () => NavGuard.push(context, '/chat/$activityId'),
                child: Container(
                  width: double.infinity,
                  padding: const EdgeInsets.symmetric(
                    vertical: AppSpacing.x3,
                    horizontal: AppSpacing.x4,
                  ),
                  decoration: BoxDecoration(
                    color: context.colors.primarySoft,
                    borderRadius: BorderRadius.circular(AppRadius.card),
                    border: Border.all(
                      color: context.colors.primaryOnSurface.withValues(
                        alpha: 0.3,
                      ),
                    ),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(
                        Icons.forum_outlined,
                        size: 18,
                        color: context.colors.primaryOnSurface,
                      ),
                      const SizedBox(width: AppSpacing.x2),
                      Text(
                        'Open Group Chat',
                        style: AppTypography.labelField(
                          context,
                        ).copyWith(color: context.colors.primaryOnSurface),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _ChatMsgRow extends StatelessWidget {
  const _ChatMsgRow({required this.message});
  final ChatMessage message;

  @override
  Widget build(BuildContext context) {
    final time = DateFormat('h:mm a').format(message.sentAt);
    final imageUrl =
        message.imageUrl ?? ChatMessage.imageUrlFromText(message.text);
    final isPhoto = message.isImage || imageUrl != null;
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        AppAvatar(
          assetPath: message.senderAvatarAsset,
          name: message.senderName,
          size: AppAvatarSize.xs,
        ),
        const SizedBox(width: AppSpacing.x2),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      message.senderName,
                      style: AppTypography.chipLabel(
                        context,
                      ).copyWith(fontSize: 12),
                    ),
                  ),
                  Text(
                    time,
                    style: AppTypography.metaSub(
                      context,
                    ).copyWith(fontSize: 10),
                  ),
                ],
              ),
              const SizedBox(height: 2),
              if (isPhoto)
                _PhotoThumbnail(imageUrl: imageUrl)
              else
                Text(
                  message.text,
                  style: AppTypography.bodyReading(
                    context,
                  ).copyWith(color: context.colors.textSecondary, fontSize: 13),
                ),
            ],
          ),
        ),
      ],
    );
  }
}

/// 56px photo thumbnail for image messages, with an icon fallback when the remote image fails (or only a local path.

/// 56px photo thumbnail for image messages, with an icon fallback when the remote image fails (or only a local path.
class _PhotoThumbnail extends StatelessWidget {
  const _PhotoThumbnail({required this.imageUrl});
  final String? imageUrl;

  @override
  Widget build(BuildContext context) {
    if (imageUrl == null || imageUrl!.isEmpty) {
      return Container(
        width: 56,
        height: 56,
        decoration: BoxDecoration(
          color: context.colors.surfaceMuted,
          borderRadius: BorderRadius.circular(AppRadius.sm),
        ),
        alignment: Alignment.center,
        child: Icon(
          Icons.photo_outlined,
          size: 24,
          color: context.colors.textSecondary,
        ),
      );
    }
    return ClipRRect(
      borderRadius: BorderRadius.circular(AppRadius.sm),
      child: CachedNetworkImage(
        imageUrl: imageUrl!,
        width: 56,
        height: 56,
        fit: BoxFit.cover,
        placeholder: (_, _) => Container(
          width: 56,
          height: 56,
          color: context.colors.surfaceMuted,
        ),
        errorWidget: (_, _, _) => Container(
          width: 56,
          height: 56,
          color: context.colors.surfaceMuted,
          alignment: Alignment.center,
          child: Icon(
            Icons.broken_image_outlined,
            size: 24,
            color: context.colors.textSecondary,
          ),
        ),
      ),
    );
  }
}

// Action buttons.
