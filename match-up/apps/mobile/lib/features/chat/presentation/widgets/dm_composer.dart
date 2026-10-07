part of '../dm_screen.dart';

/// Message composer mirroring the group chat.
class _Composer extends StatelessWidget {
  const _Composer({
    required this.controller,
    required this.focusNode,
    required this.hasText,
    required this.sending,
    required this.onSend,
    required this.onAttach,
  });
  final TextEditingController controller;
  final FocusNode focusNode;
  final bool hasText;
  final bool sending;
  final VoidCallback onSend;
  final VoidCallback onAttach;

  @override
  Widget build(BuildContext context) {
    final canSend = hasText && !sending;
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
          // + attachment button — same circle-outline treatment as group chat.
          Semantics(
            button: true,
            label: 'Attach photo or location',
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
                textInputAction: TextInputAction.send,
                onSubmitted: (_) => onSend(),
                cursorColor: AppColors.primary,
                cursorWidth: 1.5,
                style: AppTypography.bodyMedium(
                  context,
                ).copyWith(fontSize: 15, color: context.colors.textPrimary),
                decoration: InputDecoration(
                  isCollapsed: true,
                  isDense: true,
                  hintText: 'Type message...',
                  hintStyle: AppTypography.bodyMedium(
                    context,
                  ).copyWith(fontSize: 15, color: context.colors.textTertiary),
                  filled: true,
                  fillColor: Colors.transparent,
                  border: InputBorder.none,
                  enabledBorder: InputBorder.none,
                  focusedBorder: InputBorder.none,
                  contentPadding: EdgeInsets.zero,
                ),
              ),
            ),
          ),
          const SizedBox(width: AppSpacing.x2),
          Semantics(
            button: true,
            label: 'Send message',
            child: PressableScale(
              onTap: canSend ? onSend : null,
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 150),
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: canSend ? AppColors.primary : context.colors.border,
                  shape: BoxShape.circle,
                  boxShadow: canSend ? AppShadows.glowPrimary : null,
                ),
                alignment: Alignment.center,
                child: sending
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: AppColors.textOnPrimary,
                        ),
                      )
                    : const Icon(
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
