part of '../dm_screen.dart';

class _DmHeader extends StatelessWidget {
  const _DmHeader({
    required this.peerUid,
    required this.peerName,
    required this.peerPhotoUrl,
  });
  final String peerUid;
  final String peerName;
  final String? peerPhotoUrl;

  @override
  Widget build(BuildContext context) {
    // Visual parity with the group chat header: navy brand gradient, glow circles, rounded bottom sheet edge.
    return Container(
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [_dmHeaderNavyTop, AppColors.primary],
        ),
        borderRadius: BorderRadius.vertical(
          bottom: Radius.circular(AppRadius.card),
        ),
      ),
      child: Stack(
        children: [
          Positioned(
            right: -32,
            top: -44,
            child: Container(
              width: 120,
              height: 120,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: Colors.white.withValues(alpha: 0.08),
              ),
            ),
          ),
          Positioned(
            left: 140,
            bottom: -56,
            child: Container(
              width: 100,
              height: 100,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: Colors.white.withValues(alpha: 0.06),
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(
              AppSpacing.x2,
              AppSpacing.x2,
              AppSpacing.x4,
              AppSpacing.x4,
            ),
            child: Row(
              children: [
                Semantics(
                  button: true,
                  label: 'Back',
                  child: PressableScale(
                    onTap: () async {
                      // Cold-start deep links (push taps) have no route to pop back to.
                      final popped = await Navigator.of(context).maybePop();
                      if (!popped && context.mounted) {
                        context.go('/messages');
                      }
                    },
                    child: Container(
                      width: 38,
                      height: 38,
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: 0.14),
                        borderRadius: BorderRadius.circular(AppRadius.sm),
                        border: Border.all(
                          color: Colors.white.withValues(alpha: 0.28),
                        ),
                      ),
                      alignment: Alignment.center,
                      child: const Icon(
                        Icons.arrow_back_ios_new_rounded,
                        size: 16,
                        color: Colors.white,
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: AppSpacing.x2),
                // Avatar + name — tappable to the peer profile.
                Expanded(
                  child: Semantics(
                    button: true,
                    label: 'View $peerName profile',
                    child: GestureDetector(
                      onTap: () => NavGuard.push(
                        context,
                        '/player-profile/uid/$peerUid',
                      ),
                      behavior: HitTestBehavior.opaque,
                      child: Row(
                        children: [
                          // White ring so the avatar reads crisply on navy.
                          Container(
                            padding: const EdgeInsets.all(2),
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              border: Border.all(
                                color: Colors.white.withValues(alpha: 0.5),
                                width: 1.5,
                              ),
                            ),
                            child: AppAvatar(
                              imageUrl: peerPhotoUrl,
                              name: peerName,
                              size: AppAvatarSize.sm,
                            ),
                          ),
                          const SizedBox(width: AppSpacing.x3),
                          Expanded(
                            child: Text(
                              peerName,
                              style: AppTypography.titleMedium(
                                context,
                              ).copyWith(color: Colors.white),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: AppSpacing.x3),
                // Settings — frosted glass on navy, same as group chat.
                Semantics(
                  button: true,
                  label: 'Conversation settings',
                  child: PressableScale(
                    onTap: () => _DmSettingsSheet.show(
                      context,
                      peerUid: peerUid,
                      peerName: peerName,
                    ),
                    child: Container(
                      width: 38,
                      height: 38,
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: 0.14),
                        borderRadius: BorderRadius.circular(AppRadius.sm),
                        border: Border.all(
                          color: Colors.white.withValues(alpha: 0.28),
                        ),
                      ),
                      alignment: Alignment.center,
                      child: const Icon(
                        Icons.settings_outlined,
                        size: 18,
                        color: Colors.white,
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// Bottom sheet behind the DM header settings button: view the peer's profile or report them.
