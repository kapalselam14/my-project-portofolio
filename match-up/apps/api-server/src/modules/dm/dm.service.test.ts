// Tests for dm.service.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  ref: vi.fn(),
  getUserByAuthUid: vi.fn(),
  getPublicUserProfile: vi.fn(),
  createNotification: vi.fn(),
}));

vi.mock('../../database/firebase.js', () => ({
  rtdb: { ref: mocks.ref },
  firestore: { collection: vi.fn(), doc: vi.fn() },
  auth: {},
  messaging: {},
}));

vi.mock('../users/users.service.js', () => ({
  getUserByAuthUid: mocks.getUserByAuthUid,
  getPublicUserProfile: mocks.getPublicUserProfile,
}));

vi.mock('../notifications/notifications.service.js', () => ({
  createNotification: mocks.createNotification,
}));

import { dmPreviewBody, listDmMessages, resolveThread, sendDmMessage } from './dm.service.js';
import { dmThreadId } from '../../database/paths.js';

const msgVal = (senderId: string, text: string, timestamp: number) => ({
  senderId,
  text,
  timestamp,
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getUserByAuthUid.mockResolvedValue({ authUid: 'peer-1' });
  mocks.getPublicUserProfile.mockResolvedValue({ displayName: 'Peer' });
  mocks.createNotification.mockResolvedValue({ notificationId: 'n-1' });
});

describe('dmThreadId', () => {
  it('is order-independent', () => {
    expect(dmThreadId('b', 'a')).toBe(dmThreadId('a', 'b'));
    expect(dmThreadId('b', 'a')).toBe('a_b');
  });
});

describe('resolveThread', () => {
  it('returns the canonical id for a valid peer', async () => {
    const res = await resolveThread('me-1', 'peer-1');
    expect(res).toEqual({ conversationId: 'me-1_peer-1' });
  });

  it('rejects self-chat', async () => {
    await expect(resolveThread('me-1', 'me-1')).rejects.toThrow('cannot message yourself');
  });

  it('rejects unknown peers', async () => {
    mocks.getUserByAuthUid.mockResolvedValue(null);
    await expect(resolveThread('me-1', 'ghost')).rejects.toThrow('User not found');
  });
});

describe('listDmMessages', () => {
  it('returns time-sorted messages capped to limit', async () => {
    const get = vi.fn().mockResolvedValue({
      exists: () => true,
      val: () => ({
        m2: msgVal('peer-1', 'hey', 200),
        m1: msgVal('me-1', 'hi', 100),
        m3: msgVal('me-1', 'yo', 300),
      }),
    });
    mocks.ref.mockReturnValue({ get });

    const res = await listDmMessages('me-1', 'peer-1', 2);

    expect(res.map((m) => m.messageId)).toEqual(['m2', 'm3']);
    expect(mocks.ref).toHaveBeenCalledWith(expect.stringContaining('me-1_peer-1'));
  });

  it('returns empty when the thread has no messages', async () => {
    mocks.ref.mockReturnValue({
      get: async () => ({ exists: () => false }),
    });

    await expect(listDmMessages('me-1', 'peer-1')).resolves.toEqual([]);
  });
});

describe('sendDmMessage', () => {
  it('pushes, notifies the peer, and returns ids', async () => {
    const set = vi.fn().mockResolvedValue(undefined);
    mocks.ref.mockReturnValue({
      push: () => ({ key: 'msg-1', set }),
    });

    const res = await sendDmMessage('me-1', 'peer-1', '  hello  ');

    expect(res).toEqual({ messageId: 'msg-1', conversationId: 'me-1_peer-1' });
    expect(set).toHaveBeenCalledWith(expect.objectContaining({ senderId: 'me-1', text: 'hello' }));
    expect(mocks.createNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientUid: 'peer-1',
        type: 'dm_message',
        senderUid: 'me-1',
      }),
    );
  });

  it('rejects blank and overlong text', async () => {
    await expect(sendDmMessage('me-1', 'peer-1', '   ')).rejects.toThrow('text is required');
    await expect(sendDmMessage('me-1', 'peer-1', 'x'.repeat(2001))).rejects.toThrow(
      'at most 2000 characters',
    );
  });

  it('sends a photo URL and notifies with a photo label', async () => {
    const set = vi.fn().mockResolvedValue(undefined);
    mocks.ref.mockReturnValue({
      push: () => ({ key: 'msg-photo', set }),
    });
    const url = 'https://firebasestorage.googleapis.com/v0/b/app/o/uploads%2Fimg.jpg?alt=media';

    const res = await sendDmMessage('me-1', 'peer-1', url);

    expect(res.messageId).toBe('msg-photo');
    expect(set).toHaveBeenCalledWith(expect.objectContaining({ senderId: 'me-1', text: url }));
    expect(mocks.createNotification).toHaveBeenCalledWith(
      expect.objectContaining({ body: '📷 Photo' }),
    );
  });

  it('sends a shared location and notifies with a location label', async () => {
    const set = vi.fn().mockResolvedValue(undefined);
    mocks.ref.mockReturnValue({
      push: () => ({ key: 'msg-loc', set }),
    });
    const text = '📍 Shared location: https://maps.google.com/?q=-36.85,174.76';

    const res = await sendDmMessage('me-1', 'peer-1', text);

    expect(res.messageId).toBe('msg-loc');
    expect(set).toHaveBeenCalledWith(expect.objectContaining({ senderId: 'me-1', text }));
    expect(mocks.createNotification).toHaveBeenCalledWith(
      expect.objectContaining({ body: '📍 Shared location' }),
    );
  });
});

describe('dmPreviewBody', () => {
  it('maps photo URLs to a label', () => {
    expect(dmPreviewBody('https://example.com/uploads/img.jpg')).toBe('📷 Photo');
  });

  it('maps shared locations to a label', () => {
    expect(dmPreviewBody('📍 Shared location: https://maps.google.com/?q=1,2')).toBe(
      '📍 Shared location',
    );
  });

  it('passes plain text through (truncated at 100 chars)', () => {
    expect(dmPreviewBody('hello')).toBe('hello');
    expect(dmPreviewBody('x'.repeat(150))).toBe(`${'x'.repeat(100)}…`);
  });

  it('does not mistake text containing a URL for a photo', () => {
    expect(dmPreviewBody('see https://example.com/a please')).toBe(
      'see https://example.com/a please',
    );
  });
});
