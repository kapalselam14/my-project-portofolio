part of '../manage_activity_screen.dart';

class _ManageBody extends StatelessWidget {
  const _ManageBody({
    required this.activityId,
    required this.activity,
    required this.roster,
    required this.requests,
    required this.deciding,
    required this.kicking,
    required this.onEdit,
    required this.onCancel,
    required this.onComplete,
    required this.onApprove,
    required this.onDecline,
    required this.onKick,
  });

  final String activityId;
  final ActivityModel activity;
  final List<ActivityParticipant> roster;

  /// Pending join requests (approval-gated activities only, host view).
  final List<ActivityParticipant> requests;

  /// Uids with a decision in flight — their rows render disabled.
  final Set<String> deciding;

  /// Uids with a kick in flight — their Remove buttons render disabled.
  final Set<String> kicking;
  final VoidCallback onEdit;
  final VoidCallback onCancel;
  final VoidCallback onComplete;

  /// `onApprove(uid, displayName)` / `onDecline(uid, displayName)`.
  final void Function(String uid, String name) onApprove;
  final void Function(String uid, String name) onDecline;

  /// `onKick(uid, displayName)` — host-only removal from the roster.
  final void Function(String uid, String name) onKick;

  static const double _heroHeight = 280;
  static const double _overlapAmount = 44;

  /// True for terminal backend lifecycles — no further host transitions.
  static bool _isTerminalLifecycle(String lc) =>
      lc == 'cancelled' || lc == 'completed' || lc == 'removed';

  @override
  Widget build(BuildContext context) {
    // Raw backend lifecycle (open/full/cancelled/completed/removed), preserved on ActivityModel.lifecycleStatus.
    final lc = activity.lifecycleStatus.toLowerCase();
    final String badgeLabel;
    if (lc == 'cancelled' || lc == 'removed') {
      badgeLabel = 'CANCELLED';
    } else if (lc == 'completed') {
      badgeLabel = 'COMPLETED';
    } else if (lc == 'full') {
      badgeLabel = 'FULL';
    } else if (activity.status == ActivityStatus.past) {
      // Payloads without a raw lifecycle (hand-built fixtures).
      badgeLabel = activity.endTime.isBefore(DateTime.now())
          ? 'COMPLETED'
          : 'CANCELLED';
    } else {
      badgeLabel = 'ACTIVE';
    }
    final Color badgeBg = badgeLabel == 'CANCELLED'
        ? context.colors.errorLight
        : badgeLabel == 'COMPLETED'
        ? context.colors.surfaceMuted
        : badgeLabel == 'FULL'
        ? context.colors.warningBg
        : context.colors.statusSuccessBg;
    final Color badgeFg = badgeLabel == 'CANCELLED'
        ? context.colors.errorText
        : badgeLabel == 'COMPLETED'
        ? context.colors.textSecondary
        : badgeLabel == 'FULL'
        ? context.colors.warningText
        // successText, not raw avatarSecondary: #097044 on the dark success bg is 2.4:1.
        : context.colors.successText;
    // "Mark as completed" is available once the game started and while its lifecycle is still open.
    final bool showComplete = !_isTerminalLifecycle(lc) && activity.hasStarted;

    return Stack(
      children: [
        // Hero.
        SizedBox(
          height: _heroHeight,
          width: double.infinity,
          child: _Hero(activity: activity, onEdit: onEdit),
        ),

        // White card.
        Positioned(
          top: _heroHeight - _overlapAmount,
          left: 0,
          right: 0,
          bottom: 0,
          child: Container(
            decoration: BoxDecoration(
              color: context.colors.surface,
              borderRadius: const BorderRadius.vertical(
                top: Radius.circular(AppRadius.xl),
              ),
              boxShadow: AppShadows.sheet,
            ),
            child: SingleChildScrollView(
              padding: const EdgeInsets.fromLTRB(
                AppSpacing.x5,
                AppSpacing.x5,
                AppSpacing.x5,
                AppSpacing.x8,
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Title + status badge
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Expanded(
                        child: Text(
                          activity.title,
                          style: AppTypography.headingDisplay(context),
                        ),
                      ),
                      const SizedBox(width: AppSpacing.x3),
                      LabelBadge(
                        label: badgeLabel,
                        background: badgeBg,
                        foreground: badgeFg,
                      ),
                    ],
                  ),
                  const SizedBox(height: AppSpacing.x4),

                  // Capacity progress card (server-truth count, not the locally loaded roster slice).
                  _CapacityCard(
                    activity: activity,
                    joined: activity.participantCount,
                  ),
                  const SizedBox(height: AppSpacing.x3),

                  // Meta card — date + location
                  _MetaCard(activity: activity),
                  const SizedBox(height: AppSpacing.x5),

                  // Quick actions
                  _QuickActions(
                    activityId: activityId,
                    activity: activity,
                    onEdit: onEdit,
                  ),
                  const SizedBox(height: AppSpacing.x5),

                  // Participants
                  _ParticipantsSection(
                    activityId: activityId,
                    roster: roster,
                    // Kicking only makes sense while the game is still live — same terminal rule as Cancel/Complete.
                    canKick: !_isTerminalLifecycle(lc),
                    kicking: kicking,
                    onKick: onKick,
                  ),
                  const SizedBox(height: AppSpacing.x5),

                  // Pending join requests (approval policy only).
                  if (requests.isNotEmpty) ...[
                    _JoinRequestsSection(
                      requests: requests,
                      deciding: deciding,
                      onApprove: (p) => onApprove(p.userId, p.name),
                      onDecline: (p) => onDecline(p.userId, p.name),
                    ),
                    const SizedBox(height: AppSpacing.x5),
                  ] else ...[
                    _EmptyRequestsHint(isApproval: activity.requiresApproval),
                    const SizedBox(height: AppSpacing.x5),
                  ],

                  // Activity details
                  _DetailsSection(activity: activity),
                  const SizedBox(height: AppSpacing.x5),

                  // Mark as completed — once the game started and while its lifecycle is still open.
                  if (showComplete) ...[
                    _CompleteButton(onTap: onComplete),
                    const SizedBox(height: AppSpacing.x3),
                  ],

                  // Cancel — hidden once terminal, same rule as Mark as Completed above.
                  if (!_isTerminalLifecycle(lc)) ...[
                    _CancelButton(onTap: onCancel),
                  ],
                ],
              ),
            ),
          ),
        ),
      ],
    );
  }
}

// Hero.

class _Hero extends StatelessWidget {
  const _Hero({required this.activity, required this.onEdit});
  final ActivityModel activity;
  final VoidCallback onEdit;

  @override
  Widget build(BuildContext context) {
    return Stack(
      fit: StackFit.expand,
      children: [
        activity.coverImageUrl != null
            ? AssetImageWithFallback(
                imagePath: activity.coverImageUrl!,
                fit: BoxFit.cover,
              )
            : _placeholder(),

        const DecoratedBox(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
              colors: [AppColors.scrimTransparent, AppColors.scrimGradient],
              stops: [0.45, 1.0],
            ),
          ),
        ),

        // Back + edit buttons
        Positioned(
          top: 0,
          left: 0,
          right: 0,
          child: SafeArea(
            bottom: false,
            child: Padding(
              padding: const EdgeInsets.symmetric(
                horizontal: AppSpacing.x5,
                vertical: AppSpacing.x2,
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  _HeroBtn(
                    icon: Icons.arrow_back_ios_new_rounded,
                    onTap: () => Navigator.of(context).maybePop(),
                    label: 'Back',
                  ),
                  _HeroBtn(
                    icon: Icons.edit_outlined,
                    onTap: onEdit,
                    label: 'Edit activity',
                  ),
                ],
              ),
            ),
          ),
        ),

        // Sport + HOST badges
        Positioned(
          left: AppSpacing.x5,
          bottom: AppSpacing.x4 + 40,
          child: Row(
            children: [
              _PillBadge(
                label: activity.sportType.toUpperCase(),
                bgColor: AppColors.textOnPrimary,
                textColor: AppColors.textPrimary,
              ),
              const SizedBox(width: AppSpacing.x2),
              _PillBadge(
                label: '👑  HOST',
                bgColor: context.colors.warningBg,
                textColor: context.colors.warningText,
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _placeholder() => Container(
    decoration: const BoxDecoration(
      gradient: LinearGradient(
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
        colors: [AppColors.primary, AppColors.primaryDark],
      ),
    ),
    child: Center(
      child: Icon(
        Icons.sports,
        size: 64,
        color: AppColors.textOnPrimary.withValues(alpha: 0.38),
      ),
    ),
  );
}

class _HeroBtn extends StatelessWidget {
  const _HeroBtn({
    required this.icon,
    required this.onTap,
    required this.label,
  });
  final IconData icon;
  final VoidCallback onTap;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: label,
      child: PressableScale(
        onTap: onTap,
        child: SizedBox(
          width: 44,
          height: 44,
          child: Center(
            child: Container(
              width: 36,
              height: 36,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: AppColors.scrimControl,
                borderRadius: BorderRadius.circular(AppRadius.md),
              ),
              child: Icon(icon, size: 18, color: AppColors.textOnPrimary),
            ),
          ),
        ),
      ),
    );
  }
}

class _PillBadge extends StatelessWidget {
  const _PillBadge({
    required this.label,
    required this.bgColor,
    required this.textColor,
  });
  final String label;
  final Color bgColor;
  final Color textColor;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: BorderRadius.circular(AppRadius.pill),
      ),
      child: Text(
        label,
        style: AppTypography.chipLabel(
          context,
        ).copyWith(color: textColor, fontSize: 11),
      ),
    );
  }
}

// Capacity card.
