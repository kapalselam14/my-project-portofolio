// Tests for notifications.templates.
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../database/firebase.js', () => ({
  firestore: { collection: vi.fn(), collectionGroup: vi.fn(), doc: vi.fn() },
  auth: {},
  rtdb: {},
  messaging: {},
}));

import { firestore } from '../../database/firebase.js';
import { displayNameOf, renderTemplate } from './notifications.service.js';

function mockTemplate(data: Record<string, unknown> | null) {
  const get = vi
    .fn()
    .mockResolvedValue(data === null ? { exists: false } : { exists: true, data: () => data });
  const doc = vi.fn().mockReturnValue({ get });
  vi.mocked(firestore.collection).mockReturnValue({ doc } as never);
}

function mockUser(name: unknown) {
  const get = vi.fn().mockResolvedValue({
    exists: true,
    data: () => ({ displayName: name }),
  });
  const doc = vi.fn().mockReturnValue({ get });
  vi.mocked(firestore.collection).mockReturnValue({ doc } as never);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('renderTemplate', () => {
  it('fills variables', async () => {
    mockTemplate({
      title: 'Hi {{userName}}!',
      body: 'Joined {{activityName}} ({{n}}/{{m}}).',
      enabled: true,
    });
    const out = await renderTemplate('activity.joined', {
      userName: 'Sam',
      activityName: 'Run',
      n: '3',
      m: '10',
    });
    expect(out).toEqual({
      title: 'Hi Sam!',
      body: 'Joined Run (3/10).',
    });
    expect(firestore.collection).toHaveBeenCalledWith('notificationTemplates');
  });

  it('renders missing variables as empty', async () => {
    mockTemplate({ title: 'A {{x}} B', body: 'C', enabled: true });
    const out = await renderTemplate('t', {});
    expect(out).toEqual({ title: 'A  B', body: 'C' });
  });

  it('returns null when missing, disabled, or malformed', async () => {
    mockTemplate(null);
    expect(await renderTemplate('ghost', {})).toBeNull();

    mockTemplate({ title: 'T', body: 'B', enabled: false });
    expect(await renderTemplate('t', {})).toBeNull();

    mockTemplate({ title: 'T', enabled: true });
    expect(await renderTemplate('t', {})).toBeNull();
  });
});

describe('displayNameOf', () => {
  it('returns the display name or empty', async () => {
    mockUser('Sam');
    expect(await displayNameOf('u-1')).toBe('Sam');
    mockUser(42);
    expect(await displayNameOf('u-1')).toBe('');
  });
});
