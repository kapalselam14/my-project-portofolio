part of '../joined_activity_detail_screen.dart';

class _JoinedBanner extends StatelessWidget {
  const _JoinedBanner({required this.dateTime});
  final DateTime dateTime;

  @override
  Widget build(BuildContext context) {
    final fmt = DateFormat("EEE, MMM d 'at' h:mm a");
    return Container(
      padding: const EdgeInsets.all(AppSpacing.x4),
      decoration: BoxDecoration(
        // Theme-aware bg: the hardcoded light success fill glowed neon against a dark screen.
        color: context.colors.statusSuccessBg,
        borderRadius: BorderRadius.circular(AppRadius.card),
        border: Border.all(
          color: context.colors.successText.withValues(alpha: 0.3),
        ),
      ),
      child: Row(
        children: [
          Icon(
            Icons.check_circle_rounded,
            size: 22,
            color: context.colors.successText,
          ),
          const SizedBox(width: AppSpacing.x3),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  "You're in!",
                  style: AppTypography.labelField(
                    context,
                  ).copyWith(color: context.colors.successText),
                ),
                const SizedBox(height: 2),
                Text(
                  'See you on ${fmt.format(dateTime)}',
                  style: AppTypography.metaSub(
                    context,
                  ).copyWith(color: context.colors.successText),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// Shown in place of [_JoinedBanner] when the host cancelled the game.

/// Shown in place of [_JoinedBanner] when the host cancelled the game.
class _CancelledBanner extends StatelessWidget {
  const _CancelledBanner();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(AppSpacing.x4),
      decoration: BoxDecoration(
        color: context.colors.errorLight,
        borderRadius: BorderRadius.circular(AppRadius.card),
        border: Border.all(
          color: context.colors.errorText.withValues(alpha: 0.3),
        ),
      ),
      child: Row(
        children: [
          Icon(
            Icons.cancel_outlined,
            size: 22,
            color: context.colors.errorText,
          ),
          const SizedBox(width: AppSpacing.x3),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'This game was cancelled',
                  style: AppTypography.labelField(
                    context,
                  ).copyWith(color: context.colors.errorText),
                ),
                const SizedBox(height: 2),
                Text(
                  'The host called it off. Chat history stays readable.',
                  style: AppTypography.metaSub(
                    context,
                  ).copyWith(color: context.colors.errorText),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// Host card (matches activity detail screen. HostCard).
