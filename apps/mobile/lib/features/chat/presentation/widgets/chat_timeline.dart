part of '../chat_screen.dart';

sealed class _ListItem {}

class _DaySeparatorItem extends _ListItem {
  _DaySeparatorItem(this.label);
  final String label;
}

class _MessageItem extends _ListItem {
  _MessageItem(
    this.message, {
    required this.showAvatar,
    required this.showSenderName,
    required this.isLastOfRun,
  });
  final ChatMessage message;
  final bool showAvatar;
  final bool showSenderName;
  final bool isLastOfRun;
}

class _PollItem extends _ListItem {
  _PollItem(
    this.poll, {
    required this.showSenderName,
    required this.isLastOfRun,
  });
  final ChatPoll poll;
  final bool showSenderName;
  final bool isLastOfRun;
}

/// One row of the unified timeline — either a message or a poll — carrying the timestamp + sender used for day.

class _TimelineEntry {
  _TimelineEntry({
    required this.time,
    required this.senderId,
    this.message,
    this.poll,
  });
  final DateTime time;
  final String senderId;
  final ChatMessage? message;
  final ChatPoll? poll;
}

List<_ListItem> _buildListItems(
  List<ChatMessage> messages,
  List<ChatPoll> polls, {
  required String myUid,
}) {
  final timeline = <_TimelineEntry>[
    for (final msg in messages)
      _TimelineEntry(time: msg.sentAt, senderId: msg.senderId, message: msg),
    for (final poll in polls)
      _TimelineEntry(
        time: poll.createdAt,
        senderId: poll.createdBy,
        poll: poll,
      ),
  ]..sort((a, b) => a.time.compareTo(b.time));

  final items = <_ListItem>[];
  DateTime? lastDay;

  for (var i = 0; i < timeline.length; i++) {
    final entry = timeline[i];
    final day = DateTime(entry.time.year, entry.time.month, entry.time.day);
    if (lastDay == null || day != lastDay) {
      items.add(_DaySeparatorItem(_dayLabel(day)));
      lastDay = day;
    }

    final prev = i > 0 ? timeline[i - 1] : null;
    final next = i + 1 < timeline.length ? timeline[i + 1] : null;
    final nextSameDay =
        next != null &&
        DateTime(next.time.year, next.time.month, next.time.day) == day;
    final prevSameDay =
        prev != null &&
        DateTime(prev.time.year, prev.time.month, prev.time.day) == day;

    final isFirstOfRun =
        prev == null || prev.senderId != entry.senderId || !prevSameDay;
    final isLastOfRun =
        next == null || next.senderId != entry.senderId || !nextSameDay;
    final isMine = entry.senderId == myUid && myUid.isNotEmpty;

    final message = entry.message;
    if (message != null) {
      items.add(
        _MessageItem(
          message,
          showAvatar: isLastOfRun && !message.isMine,
          showSenderName: isFirstOfRun && !message.isMine,
          isLastOfRun: isLastOfRun,
        ),
      );
    } else {
      items.add(
        _PollItem(
          entry.poll!,
          showSenderName: isFirstOfRun && !isMine,
          isLastOfRun: isLastOfRun,
        ),
      );
    }
  }
  return items;
}

String _dayLabel(DateTime day) {
  final now = DateTime.now();
  final today = DateTime(now.year, now.month, now.day);
  final diff = today.difference(day).inDays;
  if (diff == 0) return 'TODAY';
  if (diff == 1) return 'YESTERDAY';
  const months = [
    'JAN',
    'FEB',
    'MAR',
    'APR',
    'MAY',
    'JUN',
    'JUL',
    'AUG',
    'SEP',
    'OCT',
    'NOV',
    'DEC',
  ];
  return '${months[day.month - 1]} ${day.day}';
}

class _MessageList extends ConsumerWidget {
  const _MessageList({
    required this.id,
    required this.scrollController,
    this.isArchived = false,
  });
  final String id;
  final ScrollController scrollController;

  /// Archived threads stay readable; voting is blocked with an explanation instead of a silent no-op or a backend.
  final bool isArchived;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(_messagesStreamProvider(id));
    final reactions = ref.watch(_reactionsStreamProvider(id)).valueOrNull;
    final polls =
        ref.watch(_pollsStreamProvider(id)).valueOrNull ?? const <ChatPoll>[];
    final myUid = ref.watch(_myUidProvider).valueOrNull ?? '';
    final roster = ref.watch(_participantsProvider(id)).valueOrNull ?? const [];
    final names = <String, String>{for (final p in roster) p.userId: p.name};
    return async.when(
      loading: () => const SkeletonList(count: 5),
      error: (_, _) => ErrorRetry(
        message: 'Could not load messages.',
        onRetry: () => ref.invalidate(_messagesStreamProvider(id)),
      ),
      data: (messages) {
        if (messages.isEmpty && polls.isEmpty) {
          return Center(
            child: Text(
              'No messages yet. Say hello!',
              style: AppTypography.bodyReading(
                context,
              ).copyWith(color: context.colors.textSecondary),
            ),
          );
        }
        final items = _buildListItems(messages, polls, myUid: myUid);
        return ListView.builder(
          controller: scrollController,
          padding: const EdgeInsets.fromLTRB(
            AppSpacing.x4,
            AppSpacing.x4,
            AppSpacing.x4,
            AppSpacing.x2,
          ),
          itemCount: items.length,
          itemBuilder: (_, i) {
            final item = items[i];
            return switch (item) {
              _DaySeparatorItem() => _DaySeparator(label: item.label),
              _MessageItem() => _Bubble(
                item: item,
                reactions:
                    reactions?[item.message.id] ??
                    const <String, List<String>>{},
                myUid: myUid,
                onReact: (emoji) {
                  if (isArchived) {
                    AppSnackbar.show(
                      context,
                      message: 'Chat is archived',
                      variant: AppSnackbarVariant.error,
                    );
                    return;
                  }
                  _toggleReaction(
                    ref,
                    context,
                    activityId: id,
                    messageId: item.message.id,
                    emoji: emoji,
                  );
                },
              ),
              _PollItem() => _PollCard(
                item: item,
                creatorName: item.poll.createdBy == myUid && myUid.isNotEmpty
                    ? 'You'
                    : (names[item.poll.createdBy] ?? item.poll.createdBy),
                isMine: item.poll.createdBy == myUid && myUid.isNotEmpty,
                myUid: myUid,
                onVote: (optionIndex) {
                  if (isArchived) {
                    AppSnackbar.show(
                      context,
                      message: 'Chat is archived',
                      variant: AppSnackbarVariant.error,
                    );
                    return;
                  }
                  _votePoll(
                    ref,
                    context,
                    activityId: id,
                    pollId: item.poll.pollId,
                    optionIndex: optionIndex,
                  );
                },
              ),
            };
          },
        );
      },
    );
  }
}

// Day separator.

class _DaySeparator extends StatelessWidget {
  const _DaySeparator({required this.label});
  final String label;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: AppSpacing.x4),
      child: Center(
        child: Text(
          label,
          style: AppTypography.metaSub(context).copyWith(
            fontSize: 11,
            fontWeight: FontWeight.w600,
            letterSpacing: 1.0,
            color: context.colors.textTertiary,
          ),
        ),
      ),
    );
  }
}

// Bubble.
