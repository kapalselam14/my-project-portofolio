part of '../joined_activity_detail_screen.dart';

class _HostCard extends StatelessWidget {
  const _HostCard({
    required this.activityId,
    required this.hostName,
    required this.hostId,
    required this.hostRating,
  });
  final String activityId;
  final String hostName;
  final String hostId;
  final double? hostRating;

  /// Opens a 1-on-1 thread with the host (`/dm/:uid`).
  void _messageHost(BuildContext context) {
    final id = hostId.trim();
    if (id.isNotEmpty) {
      NavGuard.push(context, '/dm/$id');
    } else {
      NavGuard.push(context, '/chat/$activityId');
    }
  }

  @override
  Widget build(BuildContext context) {
    // Local for flow promotion (fields never promote).
    final rating = hostRating;
    return PressableScale(
      // pushOnce guard: duplicate pushes share a page key and red-screen ('!keyReservation.contains(key)').
      onTap: () => NavGuard.push(
        context,
        hostId.trim().isNotEmpty
            ? '/player-profile/uid/${hostId.trim()}'
            : '/player-profile/$hostName',
      ),
      child: Container(
        padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.x4,
          vertical: AppSpacing.x3,
        ),
        decoration: BoxDecoration(
          color: context.colors.surface,
          borderRadius: BorderRadius.circular(AppRadius.card),
          border: Border.all(color: context.colors.border),
          boxShadow: AppShadows.card,
        ),
        child: Row(
          children: [
            AppAvatar(name: hostName, size: AppAvatarSize.sm),
            const SizedBox(width: AppSpacing.x3),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    hostName,
                    style: AppTypography.labelField(
                      context,
                    ).copyWith(fontSize: 15, fontWeight: FontWeight.w700),
                  ),
                  Text('Host', style: AppTypography.metaSub(context)),
                ],
              ),
            ),
            // Message button
            AppTappable(
              semanticLabel: 'Message host',
              feedback: AppTapFeedback.scale,
              minSize: 36,
              onTap: () => _messageHost(context),
              child: Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: context.colors.primarySoft,
                  shape: BoxShape.circle,
                ),
                child: Icon(
                  Icons.message_rounded,
                  size: 16,
                  color: context.colors.primaryOnSurface,
                ),
              ),
            ),
            const SizedBox(width: AppSpacing.x3),
            // Rating — real average, or "New host" when unrated.
            if (rating != null)
              Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(
                    Icons.star_rounded,
                    size: 16,
                    color: context.colors.successText,
                  ),
                  const SizedBox(width: 4),
                  Text(
                    rating.toStringAsFixed(1),
                    style: AppTypography.labelField(context).copyWith(
                      color: context.colors.successText,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ],
              )
            else
              Text(
                'New host',
                style: AppTypography.metaSub(
                  context,
                ).copyWith(fontWeight: FontWeight.w600),
              ),
          ],
        ),
      ),
    );
  }
}

// ─── Meta card (date + location) — matches activity_detail_screen ─────────────

class _MetaCard extends StatelessWidget {
  const _MetaCard({required this.activity});
  final ActivityModel activity;

  @override
  Widget build(BuildContext context) {
    final date = DateFormat('EEEE, MMMM d').format(activity.dateTime);
    final start = DateFormat('h:mm a').format(activity.dateTime);
    final end = DateFormat('h:mm a').format(activity.endTime);
    final address =
        activity.addressLine ?? distanceLabel(activity.distanceKm) ?? '';

    return Container(
      decoration: BoxDecoration(
        color: context.colors.surface,
        borderRadius: BorderRadius.circular(AppRadius.card),
        border: Border.all(color: context.colors.border),
        boxShadow: AppShadows.card,
      ),
      child: Column(
        children: [
          _MetaRow(
            icon: Icons.calendar_month_outlined,
            title: date,
            sub: '$start – $end',
          ),
          Divider(height: 1, color: context.colors.border, indent: 60),
          _MetaRow(
            icon: Icons.place_outlined,
            title: activity.location,
            sub: address,
          ),
          Divider(height: 1, color: context.colors.border, indent: 60),
          _MetaRow(
            icon: Icons.attach_money_rounded,
            title: !activity.isPaid
                ? 'Free Activity'
                : activity.isSplitCost
                ? 'Split Cost'
                : 'Paid Activity',
            sub: !activity.isPaid
                ? 'No cost to join'
                : activity.splitExplainer ??
                      activity.feeLabel ??
                      'Fee required to join',
            trailingChip: _FeeChip(isPaid: activity.isPaid),
          ),
        ],
      ),
    );
  }
}

class _MetaRow extends StatelessWidget {
  const _MetaRow({
    required this.icon,
    required this.title,
    required this.sub,
    this.trailingChip,
  });
  final IconData icon;
  final String title;
  final String sub;
  final Widget? trailingChip;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.x4,
        vertical: AppSpacing.x3,
      ),
      child: Row(
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: context.colors.primarySoft,
              shape: BoxShape.circle,
            ),
            alignment: Alignment.center,
            child: Icon(icon, size: 18, color: context.colors.primaryOnSurface),
          ),
          const SizedBox(width: AppSpacing.x3),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: AppTypography.labelField(context)),
                const SizedBox(height: 2),
                Text(sub, style: AppTypography.metaSub(context)),
              ],
            ),
          ),
          if (trailingChip != null) ...[
            const SizedBox(width: AppSpacing.x2),
            trailingChip!,
          ],
        ],
      ),
    );
  }
}

class _FeeChip extends StatelessWidget {
  const _FeeChip({required this.isPaid});
  final bool isPaid;

  @override
  Widget build(BuildContext context) {
    final bgColor = isPaid
        ? context.colors.warningBg
        : context.colors.statusSuccessBg;
    final fgColor = isPaid
        ? context.colors.warningText
        : context.colors.successText;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: BorderRadius.circular(AppRadius.pill),
      ),
      child: Text(
        isPaid ? 'Paid' : 'Free',
        style: AppTypography.chipLabel(
          context,
        ).copyWith(color: fgColor, fontWeight: FontWeight.w700, fontSize: 12),
      ),
    );
  }
}

// Participants section.
