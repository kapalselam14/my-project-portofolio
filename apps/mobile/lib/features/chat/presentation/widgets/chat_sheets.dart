part of '../chat_screen.dart';

class _ReactionPickerSheet extends StatelessWidget {
  const _ReactionPickerSheet({required this.onPick});
  final ValueChanged<String> onPick;

  static Future<void> show(
    BuildContext context, {
    required ValueChanged<String> onPick,
  }) {
    HapticFeedback.lightImpact();
    return showModalBottomSheet<void>(
      context: context,
      // Root navigator so the scrim covers the tab bar too.
      useRootNavigator: true,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      barrierColor: Colors.black54,
      elevation: 0,
      builder: (_) => _ReactionPickerSheet(onPick: onPick),
    );
  }

  @override
  Widget build(BuildContext context) {
    // Floating panel with a gap above the bottom edge.
    final bottomInset = MediaQuery.of(context).viewPadding.bottom;
    return SafeArea(
      top: false,
      child: Padding(
        padding: EdgeInsets.fromLTRB(
          AppSpacing.x4,
          0,
          AppSpacing.x4,
          // 16px lift + home-indicator inset so the composer floats.
          AppSpacing.x4 + bottomInset,
        ),
        child: Container(
          padding: const EdgeInsets.fromLTRB(
            AppSpacing.x5,
            AppSpacing.x3,
            AppSpacing.x5,
            AppSpacing.x5,
          ),
          decoration: BoxDecoration(
            color: context.colors.surface,
            borderRadius: BorderRadius.circular(24),
            boxShadow: AppShadows.card,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 36,
                height: 4,
                decoration: BoxDecoration(
                  color: context.colors.border,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              const SizedBox(height: AppSpacing.x4),
              Wrap(
                alignment: WrapAlignment.center,
                spacing: AppSpacing.x2,
                runSpacing: AppSpacing.x2,
                children: [
                  for (final emoji in reactionEmojis)
                    PressableScale(
                      onTap: () {
                        Navigator.of(context).pop();
                        onPick(emoji);
                      },
                      child: Container(
                        width: 48,
                        height: 48,
                        alignment: Alignment.center,
                        decoration: BoxDecoration(
                          color: context.colors.surfaceMuted,
                          shape: BoxShape.circle,
                        ),
                        child: Text(
                          emoji,
                          style: const TextStyle(fontSize: 26),
                        ),
                      ),
                    ),
                ],
              ),
              const SizedBox(height: AppSpacing.x2),
            ],
          ),
        ),
      ),
    );
  }
}

/// Compact `emoji count` chips under a reacted bubble.

class _ReactionChips extends StatelessWidget {
  const _ReactionChips({
    required this.reactions,
    required this.myUid,
    required this.onToggle,
  });
  final EmojiReactions reactions;
  final String myUid;
  final ValueChanged<String>? onToggle;

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: 4,
      runSpacing: 4,
      children: [
        for (final entry in reactions.entries)
          PressableScale(
            onTap: onToggle == null ? null : () => onToggle!(entry.key),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
              decoration: BoxDecoration(
                color: entry.value.contains(myUid)
                    ? context.colors.primarySoft
                    : context.colors.surface,
                borderRadius: BorderRadius.circular(AppRadius.pill),
                border: Border.all(
                  color: entry.value.contains(myUid)
                      ? context.colors.primaryOnSurface
                      : context.colors.border,
                ),
              ),
              child: Text(
                '${entry.key} ${entry.value.length}',
                style: const TextStyle(fontSize: 12),
              ),
            ),
          ),
      ],
    );
  }
}

// Poll card.

/// Inline single-choice poll card.
