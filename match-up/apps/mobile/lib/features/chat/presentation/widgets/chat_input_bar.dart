part of '../chat_screen.dart';

class _InputBar extends StatelessWidget {
  const _InputBar({
    required this.controller,
    required this.focusNode,
    required this.hasText,
    required this.onSend,
    required this.onAttach,
    this.isArchived = false,
  });
  final TextEditingController controller;
  final FocusNode focusNode;
  final bool hasText;
  final VoidCallback onSend;
  final VoidCallback onAttach;

  /// Archived threads render a read-only notice in place of the composer.
  final bool isArchived;

  @override
  Widget build(BuildContext context) {
    if (isArchived) {
      return Container(
        padding: EdgeInsets.only(
          left: AppSpacing.x4,
          right: AppSpacing.x4,
          top: AppSpacing.x3,
          bottom: AppSpacing.x3 + MediaQuery.of(context).viewPadding.bottom,
        ),
        decoration: BoxDecoration(
          color: context.colors.surface,
          border: Border(top: BorderSide(color: context.colors.border)),
        ),
        child: Container(
          padding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.x4,
            vertical: 12,
          ),
          decoration: BoxDecoration(
            color: context.colors.surfaceMuted,
            borderRadius: BorderRadius.circular(AppRadius.pill),
          ),
          alignment: Alignment.center,
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                Icons.archive_outlined,
                size: 18,
                color: context.colors.textSecondary,
              ),
              const SizedBox(width: AppSpacing.x2),
              Flexible(
                child: Text(
                  'Chat archived · history is read-only',
                  style: AppTypography.bodyMedium(
                    context,
                  ).copyWith(fontSize: 14, color: context.colors.textSecondary),
                  textAlign: TextAlign.center,
                ),
              ),
            ],
          ),
        ),
      );
    }
    return Container(
      padding: EdgeInsets.only(
        left: AppSpacing.x4,
        right: AppSpacing.x4,
        top: AppSpacing.x3,
        bottom: AppSpacing.x3 + MediaQuery.of(context).viewPadding.bottom,
      ),
      decoration: BoxDecoration(
        color: context.colors.surface,
        border: Border(top: BorderSide(color: context.colors.border)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          // + attachment button — circle outline
          Semantics(
            button: true,
            label: 'Attach',
            child: PressableScale(
              onTap: onAttach,
              child: Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: Colors.transparent,
                  shape: BoxShape.circle,
                  border: Border.all(color: context.colors.border, width: 1.5),
                ),
                alignment: Alignment.center,
                child: Icon(
                  Icons.add_rounded,
                  size: 22,
                  color: context.colors.textSecondary,
                ),
              ),
            ),
          ),
          const SizedBox(width: AppSpacing.x2),

          // Text field — pill, white, no outline on focus
          Expanded(
            child: Container(
              constraints: const BoxConstraints(minHeight: 44),
              padding: const EdgeInsets.symmetric(
                horizontal: AppSpacing.x4,
                vertical: 10,
              ),
              decoration: BoxDecoration(
                color: context.colors.surfaceMuted,
                borderRadius: BorderRadius.circular(AppRadius.pill),
              ),
              child: TextField(
                controller: controller,
                focusNode: focusNode,
                minLines: 1,
                maxLines: 4,
                cursorColor: AppColors.primary,
                cursorWidth: 1.5,
                style: AppTypography.bodyMedium(
                  context,
                ).copyWith(fontSize: 15, color: context.colors.textPrimary),
                decoration: InputDecoration(
                  hintText: 'Type message...',
                  hintStyle: AppTypography.bodyMedium(
                    context,
                  ).copyWith(fontSize: 15, color: context.colors.textTertiary),
                  filled: true,
                  fillColor: Colors.transparent,
                  border: InputBorder.none,
                  enabledBorder: InputBorder.none,
                  focusedBorder: InputBorder.none,
                  isDense: true,
                  contentPadding: EdgeInsets.zero,
                ),
              ),
            ),
          ),
          const SizedBox(width: AppSpacing.x2),

          // Send button — solid blue circle with up-arrow
          Semantics(
            button: true,
            label: 'Send message',
            child: PressableScale(
              onTap: hasText ? onSend : null,
              child: AnimatedContainer(
                duration: AppDurations.fast,
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: hasText ? AppColors.primary : context.colors.border,
                  shape: BoxShape.circle,
                  boxShadow: hasText ? AppShadows.glowPrimary : null,
                ),
                alignment: Alignment.center,
                child: const Icon(
                  Icons.arrow_upward_rounded,
                  size: 22,
                  color: AppColors.textOnPrimary,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// Chat settings sheet.

/// Route for "View activity details" from chat: the viewer is a member here, so never the discover (join-flow) detail.
String _detailsRoute(ActivityModel? activity, String activityId) {
  if (activity == null) return '/activity/$activityId';
  if (activity.status == ActivityStatus.past) {
    return '/past-activity/$activityId/review';
  }
  if (activity.isHost) return '/manage-activity/$activityId';
  if (activity.isParticipant) return '/joined-activity/$activityId';
  return '/activity/$activityId';
}

/// Bottom sheet behind the header settings button: view the activity, open its photo album, toggle the local mute.
