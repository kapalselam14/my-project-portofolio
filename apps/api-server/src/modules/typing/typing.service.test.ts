// Tests for typing.service.
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../database/firebase.js', () => {
  return {
    rtdb: { ref: vi.fn() },
  };
});

import { rtdb } from '../../database/firebase.js';
import { getTyping, setTyping, TYPING_TTL_MS } from './typing.service.js';

function mockRef(snapVal: unknown, exists: boolean) {
  const set = vi.fn().mockResolvedValue(undefined);
  const get = vi.fn().mockResolvedValue({
    exists: () => exists,
    val: () => snapVal,
  });
  vi.mocked(rtdb.ref).mockReturnValue({ get, set } as never);
  return { get, set };
}

describe('typing service TTL', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('setTyping stores isTyping with a fresh updatedAt', async () => {
    const { set } = mockRef(null, false);
    const before = Date.now();

    await setTyping('activity-1', 'uid-1', true);

    expect(rtdb.ref).toHaveBeenCalledWith('typing/activity-1/uid-1');
    expect(set).toHaveBeenCalledOnce();
    const written = vi.mocked(set).mock.calls[0][0] as Record<string, unknown>;
    expect(written.isTyping).toBe(true);
    expect(typeof written.updatedAt).toBe('number');
    expect(written.updatedAt as number).toBeGreaterThanOrEqual(before);
    expect(written.updatedAt as number).toBeLessThanOrEqual(Date.now());
  });

  it('getTyping returns true for a freshly written row', async () => {
    mockRef({ isTyping: true, updatedAt: Date.now() }, true);

    await expect(getTyping('activity-1', 'uid-1')).resolves.toEqual({
      isTyping: true,
    });
  });

  it('getTyping returns false for a stale true row', async () => {
    mockRef({ isTyping: true, updatedAt: Date.now() - TYPING_TTL_MS - 1000 }, true);

    await expect(getTyping('activity-1', 'uid-1')).resolves.toEqual({
      isTyping: false,
    });
  });

  it('getTyping returns false for a legacy row without updatedAt', async () => {
    mockRef({ isTyping: true }, true);

    await expect(getTyping('activity-1', 'uid-1')).resolves.toEqual({
      isTyping: false,
    });
  });

  it('getTyping returns false when stored false', async () => {
    mockRef({ isTyping: false, updatedAt: Date.now() }, true);

    await expect(getTyping('activity-1', 'uid-1')).resolves.toEqual({
      isTyping: false,
    });
  });

  it('getTyping returns null when no row exists', async () => {
    mockRef(null, false);

    await expect(getTyping('activity-1', 'uid-1')).resolves.toBeNull();
  });
});
