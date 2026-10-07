part of '../activity_detail_screen.dart';

class _HostCard extends StatelessWidget {
  const _HostCard({
    required this.hostName,
    required this.hostId,
    required this.hostRating,
    this.hostHostRating,
    this.hostHostRatingCount = 0,
  });
  final String hostName;
  final String hostId;
  final double? hostRating;

  /// Host-role average (stars received while hosting).
  final double? hostHostRating;
  final int hostHostRatingCount;

  @override
  Widget build(BuildContext context) {
    final canOpen = hostId.trim().isNotEmpty;
    // Local for flow promotion (fields never promote).
    final rating = hostRating;
    final hostStars = hostHostRating;
    final hostCount = hostHostRatingCount;
    return Semantics(
      button: canOpen,
      label: canOpen ? 'View host profile: $hostName' : null,
      child: PressableScale(
        // pushOnce: repeat taps while the profile is open are ignored, so duplicate page keys can never red-screen.
        onTap: canOpen
            ? () =>
                  NavGuard.push(context, '/player-profile/uid/${hostId.trim()}')
            : null,
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
              // Host-role rating badge — stars received while hosting (even one shows).
              if (hostStars != null)
                Semantics(
                  label:
                      'Host rating ${hostStars.toStringAsFixed(1)} from $hostCount reviews',
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(
                        Icons.star_rounded,
                        size: 16,
                        color: context.colors.successText,
                      ),
                      const SizedBox(width: 4),
                      Text(
                        hostCount > 0
                            ? '${hostStars.toStringAsFixed(1)} ($hostCount)'
                            : hostStars.toStringAsFixed(1),
                        style: AppTypography.labelField(context).copyWith(
                          color: context.colors.successText,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ],
                  ),
                )
              else if (rating != null)
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
              if (canOpen) ...[
                const SizedBox(width: AppSpacing.x1),
                Icon(
                  Icons.chevron_right_rounded,
                  size: 20,
                  color: context.colors.textTertiary,
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

// Meta card (date location).

class _MetaCard extends StatelessWidget {
  const _MetaCard({required this.activity});
  final ActivityModel activity;

  @override
  Widget build(BuildContext context) {
    final date = DateFormat('EEEE, MMMM d').format(activity.dateTime);
    final startTime = DateFormat('h:mm a').format(activity.dateTime);
    final endTime = DateFormat('h:mm a').format(activity.endTime);
    final timeRange = '$startTime - $endTime';
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
          _MetaRow(icon: AppIcons.calendar, title: date, sub: timeRange),
          Divider(height: 1, color: context.colors.border, indent: 60),
          _MetaRow(
            icon: AppIcons.mapPin,
            title: activity.location,
            sub: address,
          ),
          Divider(height: 1, color: context.colors.border, indent: 60),
          _MetaRow(
            icon: AppIcons.dollarSign,
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
  final String icon;
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
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: context.colors.primarySoft,
              shape: BoxShape.circle,
            ),
            alignment: Alignment.center,
            child: AppIcon(
              icon,
              size: AppIconSize.lg,
              color: context.colors.primaryOnSurface,
            ),
          ),
          const SizedBox(width: AppSpacing.x3),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: AppTypography.labelField(context)),
                // The sub-row (address / distance) hides entirely when empty so no blank line sits under the title.
                if (sub.isNotEmpty) ...[
                  const SizedBox(height: 2),
                  Text(sub, style: AppTypography.metaSub(context)),
                ],
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
    final label = isPaid ? 'Paid' : 'Free';
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: BorderRadius.circular(AppRadius.pill),
      ),
      child: Text(
        label,
        style: AppTypography.chipLabel(
          context,
        ).copyWith(color: fgColor, fontWeight: FontWeight.w700, fontSize: 12),
      ),
    );
  }
}

// Participants section.
