import 'package:flutter_test/flutter_test.dart';
import 'package:matchup_mobile/features/discovery/data/remote_activity_repository.dart';
import 'package:matchup_mobile/features/discovery/domain/activity_model.dart';
import 'package:matchup_mobile/features/discovery/domain/discovery_filter.dart';

ActivityModel _activity(String id) => ActivityModel(
  id: id,
  title: 'Game $id',
  sportType: 'Basketball',
  description: '',
  location: 'Court',
  distanceKm: 1.0,
  dateTime: DateTime.now().add(const Duration(days: 1)),
  skillLevel: 'Beginner',
  capacity: 10,
  participantCount: 2,
  hostName: 'Sam',
);

void main() {
  group('FeedCache', () {
    test('key covers filter identity + paging', () {
      const a = DiscoveryFilter();
      const b = DiscoveryFilter();
      expect(
        FeedCache.keyFor(filter: a, limit: 20, offset: 0),
        FeedCache.keyFor(filter: b, limit: 20, offset: 0),
      );
      expect(
        FeedCache.keyFor(filter: a, limit: 20, offset: 0),
        isNot(FeedCache.keyFor(filter: a, limit: 50, offset: 0)),
      );
      expect(
        FeedCache.keyFor(filter: a, limit: 20, offset: 0),
        isNot(FeedCache.keyFor(filter: null, limit: 20, offset: 0)),
      );
    });

    test('key carries a coarse 1-decimal position bucket', () {
      const f = DiscoveryFilter();
      final noPos = FeedCache.keyFor(filter: f, limit: 20, offset: 0);
      // Unknown position leaves the bucket segment empty.
      expect(noPos.endsWith('|'), isTrue);

      // Same bucket (within rounding) → same key: hit rates stay sane.
      expect(
        FeedCache.keyFor(
          filter: f,
          limit: 20,
          offset: 0,
          lat: -36.84,
          lng: 174.76,
        ),
        FeedCache.keyFor(
          filter: f,
          limit: 20,
          offset: 0,
          lat: -36.849,
          lng: 174.764,
        ),
      );

      // Moved across town → different key so stale distances miss.
      expect(
        FeedCache.keyFor(
          filter: f,
          limit: 20,
          offset: 0,
          lat: -36.8,
          lng: 174.7,
        ),
        isNot(
          FeedCache.keyFor(
            filter: f,
            limit: 20,
            offset: 0,
            lat: -41.3,
            lng: 174.8,
          ),
        ),
      );

      // Positioned vs unpositioned never collide.
      expect(
        noPos,
        isNot(
          FeedCache.keyFor(
            filter: f,
            limit: 20,
            offset: 0,
            lat: -36.8,
            lng: 174.7,
          ),
        ),
      );
    });

    test('hit before TTL, miss after', () {
      var now = DateTime(2026, 1, 1, 12);
      final cache = FeedCache(
        clock: () => now,
        ttl: const Duration(seconds: 60),
      );
      const key = 'k';
      expect(cache.isFresh(key), isFalse);

      cache.put(key, [_activity('a')]);
      expect(cache.isFresh(key), isTrue);
      expect(cache.get(key)!.map((a) => a.id), ['a']);

      now = now.add(const Duration(seconds: 59));
      expect(cache.isFresh(key), isTrue);
      now = now.add(const Duration(seconds: 1));
      expect(cache.isFresh(key), isFalse);
      expect(cache.get(key), isNull);
    });

    test('evicts oldest beyond maxEntries', () {
      final cache = FeedCache(maxEntries: 2);
      cache.put('k1', [_activity('a')]);
      cache.put('k2', [_activity('b')]);
      cache.put('k3', [_activity('c')]);

      expect(cache.length, 2);
      expect(cache.isFresh('k1'), isFalse);
      expect(cache.isFresh('k2'), isTrue);
      expect(cache.isFresh('k3'), isTrue);
    });

    test('remove + invalidateAll', () {
      final cache = FeedCache();
      cache.put('k1', [_activity('a')]);
      cache.put('k2', [_activity('b')]);

      cache.remove('k1');
      expect(cache.isFresh('k1'), isFalse);
      expect(cache.isFresh('k2'), isTrue);

      cache.invalidateAll();
      expect(cache.isFresh('k2'), isFalse);
    });
  });
}
