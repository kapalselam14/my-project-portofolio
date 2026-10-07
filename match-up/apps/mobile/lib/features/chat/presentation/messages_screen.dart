import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/providers/repository_providers.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/theme/dark_colors.dart';
import '../../../core/utils/nav_guard.dart';
import '../../../core/widgets/app_avatar.dart';
import '../../../core/widgets/app_scaffold.dart';
import '../../../core/widgets/app_tappable.dart';
import '../../../core/widgets/empty_state.dart';
import '../../../core/widgets/error_retry.dart';
import '../../../core/widgets/pressable_scale.dart';
import '../../../core/widgets/skeleton.dart';
import '../domain/chat_message.dart';

// Providers.
// keepAlive (not autoDispose): switching Group/DM tabs neither disposes nor refetches.

final _conversationsProvider = FutureProvider<List<ChatConversation>>((
  ref,
) async {
  return ref.watch(chatRepositoryProvider).conversations();
});

/// 1-on-1 threads, re-emitted on every inbox change so unread badges update while the inbox sits open.
final _dmConversationsProvider = StreamProvider<List<ChatConversation>>((ref) {
  return ref.watch(dmRepositoryProvider).watchConversations();
});

final _unreadNotifCountProvider = FutureProvider.autoDispose<int>((ref) async {
  final all = await ref.watch(notificationRepositoryProvider).all();
  return all.where((n) => n.unread).length;
});

// Screen.

class MessagesScreen extends ConsumerStatefulWidget {
  const MessagesScreen({super.key});

  @override
  ConsumerState<MessagesScreen> createState() => _MessagesScreenState();
}

class _MessagesScreenState extends ConsumerState<MessagesScreen>
    with WidgetsBindingObserver {
  final _searchController = TextEditingController();
  String _query = '';

  /// 0 = group (activity) chats, 1 = direct messages.
  int _tab = 0;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    // Messages sent from another device (or web) while the app was backgrounded land here on resume.
    if (state == AppLifecycleState.resumed && mounted) {
      ref.invalidate(_conversationsProvider);
    }
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    // The unread badge is one-shot: re-fetch whenever dependencies change so it reflects reads done on /notifications.
    ref.invalidate(_unreadNotifCountProvider);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final unreadCount = ref.watch(_unreadNotifCountProvider).valueOrNull ?? 0;
    // Tab badges reuse the same providers the lists below watch, so no extra fetch.
    final groupConvos = ref.watch(_conversationsProvider).valueOrNull;
    final dmConvos = ref.watch(_dmConversationsProvider).valueOrNull;
    int unreadOf(List<ChatConversation>? list) =>
        list?.fold<int>(0, (sum, c) => sum + c.unreadCount) ?? 0;

    return AppScaffold(
      showHomeIndicator: false,
      backgroundColor: context.colors.background,
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header.
          Padding(
            padding: const EdgeInsets.fromLTRB(
              AppSpacing.x5,
              AppSpacing.x3,
              AppSpacing.x5,
              AppSpacing.x4,
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Chat', style: AppTypography.titleScreen(context)),
                      const SizedBox(height: 2),
                      Text(
                        'Your conversations',
                        style: AppTypography.bodySmall(
                          context,
                        ).copyWith(color: context.colors.textSecondary),
                      ),
                    ],
                  ),
                ),
                _BellButton(
                  unreadCount: unreadCount,
                  onTap: () {
                    // The notifications screen marks items read; refresh the badge when coming back.
                    NavGuard.push(
                      context,
                      '/notifications',
                    ).then((_) => ref.invalidate(_unreadNotifCountProvider));
                  },
                ),
              ],
            ),
          ),

          // Search bar.
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: AppSpacing.x5),
            child: _SearchBar(
              controller: _searchController,
              onChanged: (v) => setState(() => _query = v),
              onClear: () {
                _searchController.clear();
                setState(() => _query = '');
              },
            ),
          ),
          const SizedBox(height: AppSpacing.x4),

          // Groups Direct toggle.
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: AppSpacing.x5),
            child: _InboxTabs(
              tab: _tab,
              onSelect: (i) => setState(() => _tab = i),
              groupCount: groupConvos?.length,
              dmCount: dmConvos?.length,
              groupUnread: unreadOf(groupConvos),
              dmUnread: unreadOf(dmConvos),
            ),
          ),
          const SizedBox(height: AppSpacing.x3),

          // Conversation list.
          // IndexedStack: both tabs stay alive (scroll position and data kept), no rebuild or skeleton per switch.
          Expanded(
            child: IndexedStack(
              index: _tab,
              children: [
                _ConversationList(query: _query, visible: _tab == 0),
                _DmConversationList(query: _query, visible: _tab == 1),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// Bell button.

class _BellButton extends StatelessWidget {
  const _BellButton({required this.unreadCount, required this.onTap});
  final int unreadCount;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return AppTappable(
      semanticLabel: 'Notifications',
      feedback: AppTapFeedback.scale,
      onTap: onTap,
      minSize: 44,
      child: Container(
        width: 44,
        height: 44,
        decoration: BoxDecoration(
          color: context.colors.surface,
          borderRadius: BorderRadius.circular(AppRadius.card),
          border: Border.all(color: context.colors.border),
          boxShadow: AppShadows.card,
        ),
        alignment: Alignment.center,
        child: Stack(
          clipBehavior: Clip.none,
          alignment: Alignment.center,
          children: [
            Icon(
              Icons.notifications_none_rounded,
              size: 22,
              color: context.colors.textPrimary,
            ),
            if (unreadCount > 0)
              Positioned(
                top: -3,
                right: -3,
                child: Container(
                  width: 9,
                  height: 9,
                  decoration: BoxDecoration(
                    color: context.colors.errorText,
                    shape: BoxShape.circle,
                    border: Border.all(
                      color: context.colors.surface,
                      width: 1.5,
                    ),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

// Search bar.

/// White-field search (not muted-fill) so the hint/icon in `textSecondary` sit at 4.76:1 on white — WCAG AA.
class _SearchBar extends StatefulWidget {
  const _SearchBar({
    required this.controller,
    required this.onChanged,
    required this.onClear,
  });
  final TextEditingController controller;
  final ValueChanged<String> onChanged;
  final VoidCallback onClear;

  @override
  State<_SearchBar> createState() => _SearchBarState();
}

class _SearchBarState extends State<_SearchBar> {
  final _focusNode = FocusNode();
  bool _focused = false;

  @override
  void initState() {
    super.initState();
    _focusNode.addListener(_onFocus);
  }

  void _onFocus() {
    if (mounted && _focusNode.hasFocus != _focused) {
      setState(() => _focused = _focusNode.hasFocus);
    }
  }

  @override
  void dispose() {
    _focusNode.removeListener(_onFocus);
    _focusNode.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final borderColor = _focused
        ? context.colors.primaryOnSurface
        : context.colors.border;
    return AnimatedContainer(
      duration: AppDurations.fast,
      height: 46,
      decoration: BoxDecoration(
        color: context.colors.surface,
        borderRadius: BorderRadius.circular(AppRadius.pill),
        border: Border.all(color: borderColor, width: _focused ? 1.5 : 1),
        boxShadow: _focused ? AppShadows.card : null,
      ),
      child: Row(
        children: [
          const SizedBox(width: AppSpacing.x4),
          Icon(
            Icons.search_rounded,
            size: 20,
            color: context.colors.textSecondary,
            semanticLabel: 'Search',
          ),
          const SizedBox(width: AppSpacing.x2),
          Expanded(
            child: TextField(
              controller: widget.controller,
              focusNode: _focusNode,
              onChanged: widget.onChanged,
              onSubmitted: (_) => _focusNode.unfocus(),
              keyboardType: TextInputType.text,
              textInputAction: TextInputAction.search,
              cursorColor: AppColors.primary,
              cursorWidth: 1.5,
              style: AppTypography.bodyMedium(
                context,
              ).copyWith(color: context.colors.textPrimary, fontSize: 15),
              decoration: InputDecoration(
                // Matches capability: the filter only matches chat names + last-message previews.
                hintText: 'Search chats…',
                hintStyle: AppTypography.bodyMedium(
                  context,
                ).copyWith(color: context.colors.textSecondary, fontSize: 15),
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
          if (widget.controller.text.isNotEmpty) ...[
            Semantics(
              button: true,
              label: 'Clear search',
              child: PressableScale(
                onTap: widget.onClear,
                child: Padding(
                  padding: const EdgeInsets.symmetric(
                    horizontal: AppSpacing.x3,
                  ),
                  child: Icon(
                    Icons.close_rounded,
                    size: 18,
                    color: context.colors.textSecondary,
                    semanticLabel: 'Clear search',
                  ),
                ),
              ),
            ),
          ] else
            const SizedBox(width: AppSpacing.x4),
        ],
      ),
    );
  }
}

// Conversation list.

/// Groups / Direct segmented toggle with count badges and unread dots.
class _InboxTabs extends StatelessWidget {
  const _InboxTabs({
    required this.tab,
    required this.onSelect,
    this.groupCount,
    this.dmCount,
    this.groupUnread = 0,
    this.dmUnread = 0,
  });
  final int tab;
  final ValueChanged<int> onSelect;
  final int? groupCount;
  final int? dmCount;
  final int groupUnread;
  final int dmUnread;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      label: 'Conversation type',
      child: Container(
        padding: const EdgeInsets.all(4),
        decoration: BoxDecoration(
          color: context.colors.surfaceMuted,
          borderRadius: BorderRadius.circular(AppRadius.pill),
          border: Border.all(color: context.colors.border),
        ),
        child: Row(
          children: [
            _InboxTab(
              label: 'Groups',
              selected: tab == 0,
              count: groupCount,
              hasUnread: groupUnread > 0,
              onTap: () => onSelect(0),
            ),
            _InboxTab(
              label: 'Direct',
              selected: tab == 1,
              count: dmCount,
              hasUnread: dmUnread > 0,
              onTap: () => onSelect(1),
            ),
          ],
        ),
      ),
    );
  }
}

class _InboxTab extends StatelessWidget {
  const _InboxTab({
    required this.label,
    required this.selected,
    required this.onTap,
    this.count,
    this.hasUnread = false,
  });
  final String label;
  final bool selected;
  final VoidCallback onTap;
  final int? count;
  final bool hasUnread;

  @override
  Widget build(BuildContext context) {
    final labelColor = selected
        ? context.colors.textPrimary
        : context.colors.textLabel;
    return Expanded(
      child: Semantics(
        button: true,
        selected: selected,
        label: count == null ? label : '$label, $count conversations',
        child: PressableScale(
          onTap: onTap,
          child: AnimatedContainer(
            duration: AppDurations.fast,
            padding: const EdgeInsets.symmetric(vertical: 10),
            decoration: BoxDecoration(
              color: selected ? context.colors.surface : Colors.transparent,
              borderRadius: BorderRadius.circular(AppRadius.pill),
              border: Border.all(
                color: selected ? context.colors.border : Colors.transparent,
              ),
              boxShadow: selected ? AppShadows.card : null,
            ),
            alignment: Alignment.center,
            child: Row(
              mainAxisSize: MainAxisSize.min,
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Flexible(
                  child: Text(
                    label,
                    style: AppTypography.labelField(context).copyWith(
                      color: labelColor,
                      fontWeight: selected ? FontWeight.w700 : FontWeight.w600,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                if (count != null) ...[
                  const SizedBox(width: 6),
                  Text(
                    '$count',
                    style: AppTypography.caption(context).copyWith(
                      color: selected
                          ? context.colors.primaryOnSurface
                          : context.colors.textLabel,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ],
                if (hasUnread && !selected) ...[
                  const SizedBox(width: 6),
                  Container(
                    width: 7,
                    height: 7,
                    decoration: const BoxDecoration(
                      color: AppColors.primary,
                      shape: BoxShape.circle,
                    ),
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// 1-on-1 threads reusing the group card (peer uid as id, `isGroup` false).
class _DmConversationList extends ConsumerStatefulWidget {
  const _DmConversationList({required this.query, this.visible = true});
  final String query;

  /// Only the active tab precaches avatars — the hidden tab doesn't compete for bandwidth.
  final bool visible;

  @override
  ConsumerState<_DmConversationList> createState() =>
      _DmConversationListState();
}

class _DmConversationListState extends ConsumerState<_DmConversationList>
    with AutomaticKeepAliveClientMixin {
  @override
  bool get wantKeepAlive => true;

  @override
  Widget build(BuildContext context) {
    super.build(context);
    final query = widget.query;
    final async = ref.watch(_dmConversationsProvider);
    return async.when(
      loading: () => const SkeletonList(count: 3),
      error: (_, _) => ErrorRetry(
        message: 'Could not load direct messages.',
        onRetry: () => ref.invalidate(_dmConversationsProvider),
      ),
      data: (all) {
        final filtered = query.isEmpty
            ? all
            : all
                  .where(
                    (c) =>
                        c.name.toLowerCase().contains(query.toLowerCase()) ||
                        c.lastMessage.toLowerCase().contains(
                          query.toLowerCase(),
                        ),
                  )
                  .toList();

        if (filtered.isEmpty) {
          return EmptyState(
            icon: Icons.chat_bubble_outline_rounded,
            title: query.isEmpty ? 'No direct messages' : 'No results',
            subtitle: query.isEmpty
                ? 'Visit a player profile and say hi.'
                : 'No direct messages match "$query".',
          );
        }

        return ListView.builder(
          padding: const EdgeInsets.fromLTRB(
            AppSpacing.x5,
            0,
            AppSpacing.x5,
            AppSpacing.x6,
          ),
          itemCount: filtered.length,
          itemBuilder: (_, i) => Padding(
            padding: const EdgeInsets.only(bottom: AppSpacing.x2),
            child: _ConversationCard(
              conversation: filtered[i],
              // pushOnce: repeat taps share the dm-$uid page key and red-screen.
              onTap: () => NavGuard.push(
                context,
                '/dm/${filtered[i].id}',
                extra: filtered[i].name,
              ).then((_) => ref.invalidate(_dmConversationsProvider)),
            ),
          ),
        );
      },
    );
  }
}

class _ConversationList extends ConsumerStatefulWidget {
  const _ConversationList({required this.query, this.visible = true});
  final String query;

  /// Only the active tab precaches avatars — the hidden tab doesn't compete for bandwidth.
  final bool visible;

  @override
  ConsumerState<_ConversationList> createState() => _ConversationListState();
}

class _ConversationListState extends ConsumerState<_ConversationList>
    with AutomaticKeepAliveClientMixin {
  @override
  bool get wantKeepAlive => true;

  @override
  Widget build(BuildContext context) {
    super.build(context);
    final query = widget.query;
    final async = ref.watch(_conversationsProvider);
    return async.when(
      loading: () => const SkeletonList(count: 4),
      error: (_, _) => ErrorRetry(
        message: 'Could not load messages.',
        onRetry: () => ref.invalidate(_conversationsProvider),
      ),
      data: (all) {
        final filtered = query.isEmpty
            ? all
            : all
                  .where(
                    (c) =>
                        c.name.toLowerCase().contains(query.toLowerCase()) ||
                        c.lastMessage.toLowerCase().contains(
                          query.toLowerCase(),
                        ),
                  )
                  .toList();

        if (filtered.isEmpty) {
          return EmptyState(
            icon: Icons.chat_bubble_outline_rounded,
            title: query.isEmpty ? 'No messages yet' : 'No results',
            subtitle: query.isEmpty
                ? 'Join or create an activity to start chatting.'
                : 'No conversations match "$query".',
          );
        }

        return RefreshIndicator(
          onRefresh: () => ref.refresh(_conversationsProvider.future),
          child: ListView.builder(
            // Always scrollable so pull-to-refresh works even with a short inbox.
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.fromLTRB(
              AppSpacing.x5,
              0,
              AppSpacing.x5,
              AppSpacing.x6,
            ),
            itemCount: filtered.length,
            itemBuilder: (_, i) => Padding(
              padding: const EdgeInsets.only(bottom: AppSpacing.x2),
              child: _ConversationCard(
                conversation: filtered[i],
                // `filtered[i].id` is the activity id (matches the backend contract).
                onTap: () => NavGuard.push(
                  context,
                  '/chat/${filtered[i].id}',
                ).then((_) => ref.invalidate(_conversationsProvider)),
              ),
            ),
          ),
        );
      },
    );
  }
}

// Conversation card.

class _ConversationCard extends StatelessWidget {
  const _ConversationCard({required this.conversation, required this.onTap});

  final ChatConversation conversation;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final hasUnread = conversation.unreadCount > 0;
    final isEmptyPreview = conversation.lastMessage.trim().isEmpty;
    // Fallback keeps empty threads from rendering as a blank card.
    final previewText = isEmptyPreview
        ? 'No messages yet — say hi! 👋'
        : conversation.lastMessage;
    final semanticLabel = hasUnread
        ? '${conversation.name}, ${conversation.unreadCount} unread, '
              '$previewText'
        : '${conversation.name}, $previewText';

    return Semantics(
      button: true,
      label: semanticLabel,
      child: PressableScale(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.all(AppSpacing.x3),
          decoration: BoxDecoration(
            color: context.colors.surface,
            borderRadius: BorderRadius.circular(AppRadius.card),
            border: Border.all(color: context.colors.border),
          ),
          child: Row(
            children: [
              // Avatar with sport-type badge overlaid at bottom-right
              ExcludeSemantics(
                child: _AvatarWithBadge(conversation: conversation),
              ),
              const SizedBox(width: AppSpacing.x3),

              // Name + preview text
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    // Name row
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            conversation.name,
                            style: AppTypography.labelField(context).copyWith(
                              fontSize: 15,
                              fontWeight: hasUnread
                                  ? FontWeight.w800
                                  : FontWeight.w700,
                              height: 1.2,
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        if (conversation.time.trim().isNotEmpty) ...[
                          const SizedBox(width: AppSpacing.x2),
                          // Timestamp never shrinks the title — fixed size, top-aligned so long names ellipsize.
                          Text(
                            conversation.time,
                            style: AppTypography.bodySmall(context).copyWith(
                              fontSize: 11,
                              color: hasUnread
                                  ? AppColors.primary
                                  : context.colors.textSecondary,
                              fontWeight: hasUnread
                                  ? FontWeight.w600
                                  : FontWeight.w400,
                            ),
                          ),
                        ],
                      ],
                    ),
                    const SizedBox(height: 4),
                    // Preview + badge row
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            previewText,
                            style: AppTypography.bodySmall(context).copyWith(
                              fontSize: 13,
                              color: isEmptyPreview
                                  ? context.colors.textSecondary
                                  : hasUnread
                                  ? context.colors.textPrimary
                                  : context.colors.textSecondary,
                              fontStyle: isEmptyPreview
                                  ? FontStyle.italic
                                  : FontStyle.normal,
                              fontWeight: hasUnread && !isEmptyPreview
                                  ? FontWeight.w500
                                  : FontWeight.w400,
                              height: 1.3,
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        if (hasUnread) ...[
                          const SizedBox(width: AppSpacing.x2),
                          Container(
                            constraints: const BoxConstraints(
                              minWidth: 22,
                              minHeight: 22,
                            ),
                            padding: const EdgeInsets.symmetric(horizontal: 6),
                            decoration: BoxDecoration(
                              color: AppColors.primary,
                              borderRadius: BorderRadius.circular(
                                AppRadius.pill,
                              ),
                            ),
                            alignment: Alignment.center,
                            child: Text(
                              conversation.unreadCount > 99
                                  ? '99+'
                                  : '${conversation.unreadCount}',
                              style: AppTypography.badgeSport(context).copyWith(
                                color: AppColors.textOnPrimary,
                                fontSize: 11,
                              ),
                            ),
                          ),
                        ] else ...[
                          const SizedBox(width: AppSpacing.x2),
                          Icon(
                            Icons.chevron_right_rounded,
                            size: 18,
                            color: context.colors.textTertiary,
                          ),
                        ],
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// Avatar with badge.

class _AvatarWithBadge extends StatelessWidget {
  const _AvatarWithBadge({required this.conversation});
  final ChatConversation conversation;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 56,
      height: 56,
      child: Stack(
        children: [
          // Main avatar — slightly rounded square for group chats, circle for 1-to-1s, matching the design.
          ClipRRect(
            borderRadius: BorderRadius.circular(
              conversation.isGroup ? AppRadius.card : AppRadius.pill,
            ),
            child: AppAvatar(
              assetPath: conversation.avatarAsset,
              name: conversation.name,
              size: AppAvatarSize.lg,
            ),
          ),

          // Sport/role icon badge — bottom-right corner
          Positioned(
            bottom: 0,
            right: 0,
            child: Container(
              width: 20,
              height: 20,
              decoration: BoxDecoration(
                color: AppColors.primary,
                shape: BoxShape.circle,
                border: Border.all(color: context.colors.surface, width: 2),
              ),
              alignment: Alignment.center,
              child: Icon(
                conversation.isGroup
                    ? Icons.groups_rounded
                    : Icons.sports_rounded,
                size: 10,
                color: AppColors.textOnPrimary,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
