import 'package:flutter_test/flutter_test.dart';

import 'package:matchup_mobile/features/chat/domain/chat_poll.dart';
import 'package:matchup_mobile/features/chat/domain/chat_reaction.dart';

void main() {
  group('parsePollList', () {
    test('parses the RTDB map shape keyed by poll id', () {
      final polls = parsePollList({
        'p1': {
          'question': 'What time shall we play?',
          'options': ['4 PM', '5 PM'],
          'createdBy': 'u1',
          'createdAt': 1787000000000,
          'votes': {
            '0': {'u1': 1787000000100},
            '1': {'u2': 1787000000200, 'u3': 1787000000300},
          },
        },
      });

      expect(polls, hasLength(1));
      expect(polls.first.pollId, 'p1');
      expect(polls.first.question, 'What time shall we play?');
      expect(polls.first.totalVotes, 3);
      expect(polls.first.votesFor(1), 2);
      expect(polls.first.shareFor(1), closeTo(2 / 3, 0.001));
      expect(polls.first.myVote('u2'), 1);
      expect(polls.first.myVote('nobody'), isNull);
    });

    test('parses the REST array shape carrying pollId', () {
      final polls = parsePollList([
        {
          'pollId': 'p9',
          'question': 'Q?',
          'options': ['A', 'B'],
          'createdBy': 'u9',
          'createdAt': 1787000000000,
          'votes': {
            '0': ['u9'],
          },
        },
      ]);

      expect(polls, hasLength(1));
      expect(polls.first.pollId, 'p9');
      expect(polls.first.myVote('u9'), 0);
    });

    test('skips malformed entries instead of throwing', () {
      final polls = parsePollList({
        'bad-no-question': {
          'options': ['A', 'B'],
          'createdBy': 'u1',
          'createdAt': 1,
        },
        'bad-one-option': {
          'question': 'Q?',
          'options': ['Only'],
          'createdBy': 'u1',
          'createdAt': 1,
        },
        'good': {
          'question': 'Q?',
          'options': ['A', 'B'],
          'createdBy': 'u1',
          'createdAt': 1,
        },
      });

      expect(polls.map((p) => p.pollId), ['good']);
    });

    test('returns empty for non-map non-list payloads', () {
      expect(parsePollList(null), isEmpty);
      expect(parsePollList('nope'), isEmpty);
    });
  });

  group('parseReactionMap', () {
    test('parses messageId -> emoji -> uids', () {
      final reactions = parseReactionMap({
        'm1': {
          '🔥': {'u1': 1, 'u2': 2},
          '👍': {'u1': 3},
        },
      });

      expect(reactions['m1']?['🔥'], ['u1', 'u2']);
      expect(reactionCount(reactions['m1']), 3);
      expect(hasReacted(reactions['m1'], 'u2'), isTrue);
      expect(hasReacted(reactions['m1'], 'ghost'), isFalse);
      expect(hasReacted(null, 'u1'), isFalse);
    });

    test('skips malformed entries instead of throwing', () {
      final reactions = parseReactionMap({
        'm1': {
          '🔥': {'u1': 1},
          'broken': 'not-a-map',
        },
        'm2': 'not-a-map',
      });

      expect(reactions.keys, ['m1']);
      expect(reactions['m1']?.keys, ['🔥']);
    });
  });
}
