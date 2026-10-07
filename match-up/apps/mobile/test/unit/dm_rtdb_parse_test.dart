import 'package:flutter_test/flutter_test.dart';
import 'package:matchup_mobile/features/chat/data/dm_repository.dart';

void main() {
  group('parseRtdbDmMessages', () {
    test('parses Map<dynamic, dynamic> snapshot shape', () {
      // Exactly what firebase_database hands back: NOT Map<String, dynamic>.
      final snapshot = <dynamic, dynamic>{
        'm2': <dynamic, dynamic>{
          'senderId': 'peer-1',
          'text': 'hey',
          'timestamp': 200,
        },
        'm1': <dynamic, dynamic>{
          'senderId': 'me-1',
          'text': 'hi',
          'timestamp': 100,
        },
      };

      final messages = parseRtdbDmMessages(snapshot, myUid: 'me-1');

      // Regression: the old `is Map<String, dynamic>` check dropped
      // every row here, rendering threads permanently empty.
      expect(messages.map((m) => m.id), ['m1', 'm2']);
      expect(messages[0].isMine, isTrue);
      expect(messages[1].isMine, isFalse);
      expect(messages[1].text, 'hey');
    });

    test('returns empty for null / non-map', () {
      expect(parseRtdbDmMessages(null, myUid: 'me-1'), isEmpty);
      expect(parseRtdbDmMessages('junk', myUid: 'me-1'), isEmpty);
      expect(parseRtdbDmMessages([], myUid: 'me-1'), isEmpty);
    });

    test('flags system messages (leave tombstones)', () {
      final snapshot = <dynamic, dynamic>{
        'm1': <dynamic, dynamic>{
          'senderId': 'system',
          'text': 'Sam left the group',
          'type': 'system',
          'timestamp': 100,
        },
      };

      final messages = parseRtdbDmMessages(snapshot, myUid: 'me-1');

      expect(messages, hasLength(1));
      expect(messages[0].isSystem, isTrue);
    });
  });
}
