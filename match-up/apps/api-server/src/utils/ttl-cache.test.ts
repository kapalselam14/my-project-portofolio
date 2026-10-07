// Tests for ttl cache.
import { describe, expect, it, vi } from 'vitest';

import { TtlCache } from './ttl-cache.js';

describe('TtlCache', () => {
  it('fills once and serves hits until TTL', async () => {
    let now = 1_000;
    const cache = new TtlCache<string>(5_000, () => now);
    const fill = vi.fn(async () => 'v1');

    expect(await cache.getOrFill('k', fill)).toBe('v1');
    expect(await cache.getOrFill('k', fill)).toBe('v1');
    expect(fill).toHaveBeenCalledTimes(1);

    now += 5_001;
    const fill2 = vi.fn(async () => 'v2');
    expect(await cache.getOrFill('k', fill2)).toBe('v2');
    expect(fill2).toHaveBeenCalledTimes(1);
  });

  it('coalesces concurrent fills into one flight', async () => {
    const cache = new TtlCache<string>(5_000);
    let release!: (v: string) => void;
    const gate = new Promise<string>((resolve) => {
      release = resolve;
    });
    const fill = vi.fn(() => gate);

    const [a, b] = await Promise.all([
      cache.getOrFill('k', fill).then((p) => p),
      (async () => {
        release('v');
        return cache.getOrFill('k', fill);
      })(),
    ]);
    expect(a).toBe('v');
    expect(b).toBe('v');
    expect(fill).toHaveBeenCalledTimes(1);
  });

  it('never caches failures', async () => {
    const cache = new TtlCache<string>(5_000);
    await expect(
      cache.getOrFill('k', async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    const fill = vi.fn(async () => 'recovered');
    expect(await cache.getOrFill('k', fill)).toBe('recovered');
    expect(fill).toHaveBeenCalledTimes(1);
  });

  it('invalidate drops one key or everything', async () => {
    const cache = new TtlCache<string>(5_000);
    await cache.getOrFill('a', async () => 'a1');
    await cache.getOrFill('b', async () => 'b1');

    cache.invalidate('a');
    const fillA = vi.fn(async () => 'a2');
    expect(await cache.getOrFill('a', fillA)).toBe('a2');
    expect(fillA).toHaveBeenCalledTimes(1);

    cache.invalidate();
    const fillB = vi.fn(async () => 'b2');
    expect(await cache.getOrFill('b', fillB)).toBe('b2');
    expect(fillB).toHaveBeenCalledTimes(1);
  });

  it('rejects non-positive TTL', () => {
    expect(() => new TtlCache<string>(0)).toThrow('ttlMs');
  });
});
