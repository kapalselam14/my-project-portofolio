part of '../chat_screen.dart';

class _PollCard extends StatelessWidget {
  const _PollCard({
    required this.item,
    required this.creatorName,
    required this.isMine,
    required this.myUid,
    required this.onVote,
  });
  final _PollItem item;
  final String creatorName;
  final bool isMine;
  final String myUid;
  final ValueChanged<int> onVote;

  @override
  Widget build(BuildContext context) {
    final poll = item.poll;
    final myVote = poll.myVote(myUid);
    final maxW = MediaQuery.of(context).size.width * 0.78;

    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.x4),
      child: Column(
        crossAxisAlignment: isMine
            ? CrossAxisAlignment.end
            : CrossAxisAlignment.start,
        children: [
          if (item.showSenderName)
            Padding(
              padding: const EdgeInsets.only(left: 44, bottom: 4),
              child: GestureDetector(
                onTap: () => _openSenderProfile(context, item.poll.createdBy),
                behavior: HitTestBehavior.opaque,
                child: Text(
                  creatorName,
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
              if (!isMine) const SizedBox(width: 36),
              if (!isMine) const SizedBox(width: AppSpacing.x2),
              Flexible(
                child: Container(
                  constraints: BoxConstraints(maxWidth: maxW),
                  padding: const EdgeInsets.all(AppSpacing.x3),
                  decoration: BoxDecoration(
                    color: context.colors.surface,
                    borderRadius: BorderRadius.circular(AppRadius.lg),
                    border: Border.all(
                      color: context.colors.primaryOnSurface,
                      width: 1.5,
                    ),
                    boxShadow: AppShadows.card,
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Icon(
                            Icons.bar_chart_rounded,
                            size: 14,
                            color: context.colors.primaryOnSurface,
                          ),
                          const SizedBox(width: 4),
                          Text(
                            'POLL',
                            style: AppTypography.metaSub(context).copyWith(
                              fontSize: 10,
                              fontWeight: FontWeight.w800,
                              letterSpacing: 1.0,
                              color: context.colors.primaryOnSurface,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 4),
                      Text(
                        poll.question,
                        style: AppTypography.bodyMedium(
                          context,
                        ).copyWith(fontWeight: FontWeight.w700),
                      ),
                      const SizedBox(height: AppSpacing.x2),
                      for (var i = 0; i < poll.options.length; i++)
                        Padding(
                          padding: const EdgeInsets.only(bottom: 6),
                          child: _PollOption(
                            label: poll.options[i],
                            votes: poll.votesFor(i),
                            share: poll.shareFor(i),
                            isMyVote: myVote == i,
                            onTap: () => onVote(i),
                          ),
                        ),
                      Text(
                        poll.totalVotes == 0
                            ? 'No votes yet · tap to vote'
                            : '${poll.totalVotes} vote${poll.totalVotes == 1 ? '' : 's'}'
                                  '${myVote == null ? ' · tap to vote' : ' · tap again to remove vote'}',
                        style: AppTypography.metaSub(context).copyWith(
                          fontSize: 11,
                          color: context.colors.textTertiary,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _PollOption extends StatelessWidget {
  const _PollOption({
    required this.label,
    required this.votes,
    required this.share,
    required this.isMyVote,
    required this.onTap,
  });
  final String label;
  final int votes;
  final double share;
  final bool isMyVote;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return PressableScale(
      onTap: onTap,
      child: ClipRRect(
        borderRadius: BorderRadius.circular(AppRadius.md),
        child: Stack(
          children: [
            FractionallySizedBox(
              alignment: Alignment.centerLeft,
              widthFactor: share <= 0 ? 0 : share.clamp(0.06, 1.0),
              child: Container(
                height: 40,
                color: isMyVote
                    ? context.colors.primaryOnSurface.withValues(alpha: 0.35)
                    : context.colors.primarySoft,
              ),
            ),
            Container(
              height: 40,
              padding: const EdgeInsets.symmetric(horizontal: 12),
              alignment: Alignment.centerLeft,
              child: Row(
                children: [
                  if (isMyVote)
                    Padding(
                      padding: const EdgeInsets.only(right: 6),
                      child: Icon(
                        Icons.check_circle_rounded,
                        size: 16,
                        color: context.colors.primaryOnSurface,
                      ),
                    ),
                  Expanded(
                    child: Text(
                      label,
                      style: AppTypography.bodyMedium(context).copyWith(
                        fontWeight: isMyVote
                            ? FontWeight.w700
                            : FontWeight.w500,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  const SizedBox(width: 8),
                  Text(
                    '${(share * 100).round()}%',
                    style: AppTypography.metaSub(
                      context,
                    ).copyWith(fontWeight: FontWeight.w700),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Single chat photo — local file when the message was just captured on this device, network image otherwise.
