import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:matchup_mobile/core/utils/nav_guard.dart';

import '../../../core/providers/repository_providers.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/theme/dark_colors.dart';
import '../../../core/widgets/app_scaffold.dart';
import '../../../core/widgets/app_snackbar.dart';
import '../../../core/widgets/app_tappable.dart';
import '../../../core/widgets/empty_state.dart';
import '../../../core/widgets/error_retry.dart';
import '../../../core/widgets/pressable_scale.dart';
import '../../../core/widgets/skeleton.dart';
import '../domain/app_notification.dart';
import '../services/push_routing.dart';

// UI extensions on NotificationType.

extension _NotifTypeUi on NotificationType {
  Color bgColor(BuildContext context) => switch (this) {
    NotificationType.chat => context.colors.primarySoft,
    NotificationType.activity => context.colors.warningBg,
    NotificationType.system => context.colors.statusSuccessBg,
    NotificationType.request => context.colors.warningBg,
    NotificationType.moderation => context.colors.errorLight,
  };

  Color iconColor(BuildContext context) => switch (this) {
    NotificationType.chat => context.colors.primaryOnSurface,
    NotificationType.activity => context.colors.warningText,
    NotificationType.system => context.colors.successText,
    NotificationType.request => context.colors.warningText,
    NotificationType.moderation => context.colors.errorText,
  };

  IconData get icon => switch (this) {
    NotificationType.chat => Icons.chat_bubble_outline_rounded,
    NotificationType.activity => Icons.calendar_month_outlined,
    NotificationType.system => Icons.check_circle_outline_rounded,
    NotificationType.request => Icons.person_add_outlined,
    NotificationType.moderation => Icons.warning_amber_rounded,
  };
}

// Provider.

final _notifProvider = FutureProvider.autoDispose<List<AppNotification>>((ref) {
  return ref.watch(notificationRepositoryProvider).all();
});

// Screen.

class NotificationsScreen extends ConsumerStatefulWidget {
  const NotificationsScreen({super.key});

  @override
  ConsumerState<NotificationsScreen> createState() =>
      _NotificationsScreenState();
}

class _NotificationsScreenState extends ConsumerState<NotificationsScreen> {
  int _tab = 0;

  Future<void> _markAllRead() async {
    final ok = await ref.read(notificationRepositoryProvider).markAllRead();
    // Resync either way — a failure may be partial.
    ref.invalidate(_notifProvider);
    if (!ok && mounted) {
      AppSnackbar.show(
        context,
        message: 'Could not mark all as read. Please try again.',
        variant: AppSnackbarVariant.error,
      );
    }
  }

  /// Marks one row read.
  Future<bool> _markRead(String id, {bool silent = false}) async {
    final ok = await ref.read(notificationRepositoryProvider).markRead(id);
    // Resync either way so the badge/read state matches the server.
    ref.invalidate(_notifProvider);
    if (!mounted) return ok;
    if (ok) {
      if (!silent) {
        AppSnackbar.show(
          context,
          message: 'Marked as read',
          variant: AppSnackbarVariant.success,
        );
      }
    } else {
      AppSnackbar.show(
        context,
        message: 'Could not mark as read. Please try again.',
        variant: AppSnackbarVariant.error,
      );
    }
    return ok;
  }

  /// Marks the notification read (silently), then deep-links to its screen.
  Future<void> _openNotif(AppNotification notif) async {
    await _markRead(notif.id, silent: true);
    if (!mounted) return;
    final route = routeForNotification(notif);
    if (route == null || route == '/notifications') {
      _showFullMessage(notif);
      return;
    }
    NavGuard.push(context, route);
  }

  /// Bottom sheet with the complete title + body + timestamp.
  void _showFullMessage(AppNotification notif) {
    showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      builder: (context) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(
            AppSpacing.x5,
            AppSpacing.x2,
            AppSpacing.x5,
            AppSpacing.x6,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(notif.title, style: AppTypography.titleMedium(context)),
              const SizedBox(height: AppSpacing.x2),
              Text(
                _sheetTimeAgo(notif.createdAt),
                style: AppTypography.metaSub(context),
              ),
              const SizedBox(height: AppSpacing.x3),
              Flexible(
                child: SingleChildScrollView(
                  child: Text(
                    (notif.body == null || notif.body!.isEmpty)
                        ? 'No additional details.'
                        : notif.body!,
                    style: AppTypography.bodyReading(context),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final async = ref.watch(_notifProvider);
    final all = async.valueOrNull ?? [];
    final totalCount = all.length;
    final unreadCount = all.where((n) => n.unread).length;

    return AppScaffold(
      safeAreaTop: true,
      showHomeIndicator: false,
      backgroundColor: context.colors.background,
      body: Column(
        children: [
          // Header.
          _Header(hasUnread: unreadCount > 0, onMarkAllRead: _markAllRead),

          // Tab bar.
          Padding(
            padding: const EdgeInsets.fromLTRB(
              AppSpacing.x5,
              AppSpacing.x3,
              AppSpacing.x5,
              AppSpacing.x3,
            ),
            child: _TabBar(
              selectedIndex: _tab,
              allCount: totalCount,
              unreadCount: unreadCount,
              onChanged: (i) => setState(() => _tab = i),
            ),
          ),

          // Notification list.
          Expanded(
            child: async.when(
              loading: () => const SkeletonList(count: 5),
              error: (_, _) => ErrorRetry(
                message: 'Could not load notifications.',
                onRetry: () => ref.invalidate(_notifProvider),
              ),
              data: (allNotifs) {
                final filtered = _tab == 1
                    ? allNotifs.where((n) => n.unread).toList()
                    : allNotifs;

                if (filtered.isEmpty) {
                  return EmptyState(
                    icon: Icons.notifications_none_rounded,
                    title: _tab == 1
                        ? "You're all caught up"
                        : 'No notifications yet',
                  );
                }

                final grouped = _group(filtered);
                return ListView.builder(
                  padding: const EdgeInsets.fromLTRB(
                    AppSpacing.x5,
                    0,
                    AppSpacing.x5,
                    AppSpacing.x8,
                  ),
                  itemCount: grouped.length,
                  itemBuilder: (_, i) {
                    final item = grouped[i];
                    if (item is String) {
                      return _SectionHeader(label: item);
                    }
                    final notif = item as AppNotification;
                    return Padding(
                      padding: const EdgeInsets.only(bottom: AppSpacing.x2),
                      child: _SwipeToRead(
                        key: ValueKey(notif.id),
                        onConfirm: () => _markRead(notif.id),
                        child: _NotifCard(
                          item: notif,
                          onTap: () => _openNotif(notif),
                        ),
                      ),
                    );
                  },
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  List<Object> _group(List<AppNotification> items) {
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final yesterday = today.subtract(const Duration(days: 1));
    final weekAgo = today.subtract(const Duration(days: 7));

    final todayItems = items.where((n) => n.createdAt.isAfter(today)).toList();
    final yesterdayItems = items
        .where(
          (n) => n.createdAt.isAfter(yesterday) && !n.createdAt.isAfter(today),
        )
        .toList();
    final weekItems = items
        .where(
          (n) =>
              n.createdAt.isAfter(weekAgo) && !n.createdAt.isAfter(yesterday),
        )
        .toList();
    final olderItems = items
        .where((n) => !n.createdAt.isAfter(weekAgo))
        .toList();

    final result = <Object>[];
    if (todayItems.isNotEmpty) {
      result
        ..add('TODAY')
        ..addAll(todayItems);
    }
    if (yesterdayItems.isNotEmpty) {
      result
        ..add('YESTERDAY')
        ..addAll(yesterdayItems);
    }
    if (weekItems.isNotEmpty) {
      result
        ..add('THIS WEEK')
        ..addAll(weekItems);
    }
    if (olderItems.isNotEmpty) {
      result
        ..add('EARLIER')
        ..addAll(olderItems);
    }
    return result;
  }
}

// Header.

class _Header extends StatelessWidget {
  const _Header({required this.hasUnread, required this.onMarkAllRead});
  final bool hasUnread;
  final VoidCallback onMarkAllRead;

  @override
  Widget build(BuildContext context) {
    return Container(
      color: context.colors.surface,
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.x4,
        AppSpacing.x3,
        AppSpacing.x5,
        AppSpacing.x3,
      ),
      child: Row(
        children: [
          // Back button
          Semantics(
            button: true,
            label: 'Back',
            child: PressableScale(
              onTap: () => Navigator.of(context).maybePop(),
              child: Container(
                width: 38,
                height: 38,
                decoration: BoxDecoration(
                  color: context.colors.surface,
                  borderRadius: BorderRadius.circular(AppRadius.sm),
                  border: Border.all(color: context.colors.border),
                  boxShadow: AppShadows.card,
                ),
                alignment: Alignment.center,
                child: Icon(
                  Icons.arrow_back_ios_new_rounded,
                  size: 16,
                  color: context.colors.textPrimary,
                ),
              ),
            ),
          ),
          const SizedBox(width: AppSpacing.x3),

          // Title — centered in remaining space
          Expanded(
            child: Text(
              'Notifications',
              style: AppTypography.titleSheet(context),
              textAlign: TextAlign.center,
            ),
          ),

          // Mark all read — blue text, only shown when there are unreads
          SizedBox(
            width: 72,
            child: hasUnread
                ? AppTappable(
                    semanticLabel: 'Mark all read',
                    feedback: AppTapFeedback.scale,
                    onTap: onMarkAllRead,
                    minSize: 0,
                    child: Text(
                      'Mark all read',
                      textAlign: TextAlign.right,
                      style: AppTypography.caption(context).copyWith(
                        color: context.colors.primaryOnSurface,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  )
                : const SizedBox.shrink(),
          ),
        ],
      ),
    );
  }
}

// Custom tab bar with count badges.

class _TabBar extends StatelessWidget {
  const _TabBar({
    required this.selectedIndex,
    required this.allCount,
    required this.unreadCount,
    required this.onChanged,
  });

  final int selectedIndex;
  final int allCount;
  final int unreadCount;
  final ValueChanged<int> onChanged;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 48,
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: context.colors.surface,
        borderRadius: BorderRadius.circular(AppRadius.pill),
        border: Border.all(color: context.colors.border),
      ),
      child: Row(
        children: [
          Expanded(
            child: _TabItem(
              label: 'All',
              count: allCount,
              selected: selectedIndex == 0,
              onTap: () => onChanged(0),
            ),
          ),
          Expanded(
            child: _TabItem(
              label: 'Unread',
              count: unreadCount,
              selected: selectedIndex == 1,
              onTap: () => onChanged(1),
            ),
          ),
        ],
      ),
    );
  }
}

class _TabItem extends StatelessWidget {
  const _TabItem({
    required this.label,
    required this.count,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final int count;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      selected: selected,
      label: '$label, $count',
      child: PressableScale(
        onTap: onTap,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 150),
          curve: Curves.easeOutCubic,
          decoration: BoxDecoration(
            // Theme-aware pair: a hardcoded near-black pill is invisible on a dark background.
            color: selected ? context.colors.textPrimary : Colors.transparent,
            borderRadius: BorderRadius.circular(AppRadius.pill),
          ),
          alignment: Alignment.center,
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                label,
                style: AppTypography.labelField(context).copyWith(
                  color: selected
                      ? context.colors.background
                      : context.colors.textSecondary,
                  fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
                ),
              ),
              if (count > 0) ...[
                const SizedBox(width: 6),
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 7,
                    vertical: 2,
                  ),
                  decoration: BoxDecoration(
                    color: selected
                        ? AppColors.primary
                        : context.colors.surfaceMuted,
                    borderRadius: BorderRadius.circular(AppRadius.pill),
                  ),
                  child: Text(
                    '$count',
                    style: AppTypography.metaSub(context).copyWith(
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                      color: selected
                          ? AppColors.textOnPrimary
                          : context.colors.textSecondary,
                    ),
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

// Section header.

class _SectionHeader extends StatelessWidget {
  const _SectionHeader({required this.label});
  final String label;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(0, AppSpacing.x4, 0, AppSpacing.x2),
      child: Text(
        label,
        style: AppTypography.metaSub(context).copyWith(
          fontSize: 11,
          fontWeight: FontWeight.w700,
          letterSpacing: 0.8,
          color: context.colors.textTertiary,
        ),
      ),
    );
  }
}

// Swipe to mark read.

class _SwipeToRead extends StatelessWidget {
  const _SwipeToRead({super.key, required this.child, required this.onConfirm});
  final Widget child;

  /// Awaited before the row is dismissed: returning `false`.
  final Future<bool> Function() onConfirm;

  @override
  Widget build(BuildContext context) {
    return Dismissible(
      key: key!,
      direction: DismissDirection.endToStart,
      confirmDismiss: (_) => onConfirm(),
      background: Container(
        alignment: Alignment.centerRight,
        padding: const EdgeInsets.only(right: AppSpacing.x5),
        decoration: BoxDecoration(
          color: context.colors.primarySoft,
          borderRadius: BorderRadius.circular(AppRadius.card),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              Icons.done_all_rounded,
              color: context.colors.primaryOnSurface,
              size: 18,
            ),
            const SizedBox(width: 6),
            Text(
              'Mark read',
              style: AppTypography.metaSub(context).copyWith(
                color: context.colors.primaryOnSurface,
                fontWeight: FontWeight.w700,
                fontSize: 12,
              ),
            ),
          ],
        ),
      ),
      child: child,
    );
  }
}

// Notification card.

class _NotifCard extends StatelessWidget {
  const _NotifCard({required this.item, required this.onTap});
  final AppNotification item;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final semanticLabel = item.unread
        ? '${item.title}, unread, ${_timeAgo(item.createdAt)}'
        : '${item.title}, ${_timeAgo(item.createdAt)}';

    return Semantics(
      button: true,
      label: semanticLabel,
      child: PressableScale(
        onTap: onTap,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 250),
          padding: const EdgeInsets.all(AppSpacing.x4),
          decoration: BoxDecoration(
            color: item.unread
                ? context.colors.primaryLight
                : context.colors.surface,
            borderRadius: BorderRadius.circular(AppRadius.card),
            border: Border.all(
              color: item.unread
                  ? AppColors.primary.withValues(alpha: 0.5)
                  : context.colors.border,
              width: item.unread ? 1.5 : 1,
            ),
            boxShadow: AppShadows.card,
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Icon container — rounded square, soft bg
              Container(
                width: 42,
                height: 42,
                decoration: BoxDecoration(
                  color: item.type.bgColor(context),
                  borderRadius: BorderRadius.circular(AppRadius.input),
                ),
                alignment: Alignment.center,
                child: Icon(
                  item.type.icon,
                  size: 20,
                  color: item.type.iconColor(context),
                ),
              ),
              const SizedBox(width: AppSpacing.x3),

              // Title + body + timestamp
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      item.title,
                      style: AppTypography.labelField(context).copyWith(
                        fontWeight: item.unread
                            ? FontWeight.w700
                            : FontWeight.w600,
                        fontSize: 14,
                      ),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                    if (item.body != null && item.body!.isNotEmpty) ...[
                      const SizedBox(height: 2),
                      Text(
                        item.body!,
                        style: AppTypography.metaSub(
                          context,
                        ).copyWith(fontSize: 13),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                    const SizedBox(height: 4),
                    Text(
                      _timeAgo(item.createdAt),
                      style: AppTypography.metaSub(
                        context,
                      ).copyWith(fontSize: 12),
                    ),
                  ],
                ),
              ),

              // Unread dot — decorative, announced via Semantics label
              if (item.unread)
                ExcludeSemantics(
                  child: Padding(
                    padding: const EdgeInsets.only(top: 4, left: 4),
                    child: Container(
                      width: 10,
                      height: 10,
                      decoration: const BoxDecoration(
                        color: AppColors.primary,
                        shape: BoxShape.circle,
                      ),
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }

  String _timeAgo(DateTime dt) {
    final diff = DateTime.now().difference(dt);
    if (diff.inMinutes < 1) return 'Just now';
    if (diff.inMinutes < 60) return '${diff.inMinutes}m ago';
    if (diff.inHours < 24) return '${diff.inHours}h ago';
    if (diff.inDays == 1) return 'Yesterday';
    return '${diff.inDays}d ago';
  }
}

/// Relative timestamp for the full-message sheet (mirrors the card's `_timeAgo` formatting.
String _sheetTimeAgo(DateTime dt) {
  final diff = DateTime.now().difference(dt);
  if (diff.inMinutes < 1) return 'Just now';
  if (diff.inMinutes < 60) return '${diff.inMinutes}m ago';
  if (diff.inHours < 24) return '${diff.inHours}h ago';
  if (diff.inDays == 1) return 'Yesterday';
  return '${diff.inDays}d ago';
}
