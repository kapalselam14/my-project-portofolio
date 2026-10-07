// Tests for chat.archive.
import { describe, expect, it } from 'vitest';

import { CHAT_ARCHIVE_GRACE_MS, isChatArchived } from './chat.service.js';

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date('2026-09-16T12:00:00Z').getTime();

describe('isChatArchived', () => {
  it('keeps live games writable', () => {
    expect(
      isChatArchived({
        status: 'open',
        endMs: NOW + 2 * DAY,
        nowMs: NOW,
      }),
    ).toBe(false);
  });

  it('keeps recently completed games writable inside the grace period', () => {
    expect(
      isChatArchived({
        status: 'completed',
        endMs: NOW - 6 * DAY,
        nowMs: NOW,
      }),
    ).toBe(false);
    expect(CHAT_ARCHIVE_GRACE_MS).toBe(7 * DAY);
  });

  it('archives completed games past the grace period', () => {
    expect(
      isChatArchived({
        status: 'completed',
        endMs: NOW - 8 * DAY,
        nowMs: NOW,
      }),
    ).toBe(true);
  });

  it('archives cancelled and removed games immediately', () => {
    for (const status of ['cancelled', 'removed']) {
      expect(isChatArchived({ status, endMs: NOW + 2 * DAY, nowMs: NOW })).toBe(true);
    }
  });

  it('archives stuck-open games past end + grace', () => {
    expect(isChatArchived({ status: 'open', endMs: NOW - 8 * DAY, nowMs: NOW })).toBe(true);
  });

  it('stays writable when the end time is unknown', () => {
    expect(isChatArchived({ status: 'open', endMs: null, nowMs: NOW })).toBe(false);
  });
});
