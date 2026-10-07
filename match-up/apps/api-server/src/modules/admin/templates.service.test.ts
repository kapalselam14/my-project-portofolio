// Tests for templates.service.
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../database/firebase.js', () => ({
  firestore: { collection: vi.fn(), collectionGroup: vi.fn(), doc: vi.fn() },
  auth: {},
  rtdb: {},
}));

vi.mock('./audit.service.js', () => ({
  logAdminAction: vi.fn(),
}));

import { firestore } from '../../database/firebase.js';
import { logAdminAction } from './audit.service.js';
import { listTemplates, updateTemplate } from './templates.service.js';

function mockTemplates(seed: Record<string, Record<string, unknown>> = {}) {
  const store = new Map(Object.entries(seed));
  vi.mocked(firestore.collection).mockImplementation(
    () =>
      ({
        get: async () => ({
          docs: [...store.entries()].map(([id, data]) => ({
            id,
            data: () => data,
          })),
        }),
        doc: (id: string) => ({
          get: async () => {
            const data = store.get(id);
            return data === undefined ? { exists: false } : { exists: true, id, data: () => data };
          },
          update: vi.fn().mockImplementation(async (patch: Record<string, unknown>) => {
            store.set(id, { ...(store.get(id) ?? {}), ...patch });
          }),
        }),
      }) as never,
  );
  return store;
}

const templateRow = () => ({
  trigger: 'activity.joined',
  category: 'Activity',
  name: 'Joined',
  description: 'Fires on join',
  title: 'Welcome!',
  body: 'You joined {{activity}}',
  variables: ['activity'],
  enabled: true,
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe('listTemplates', () => {
  it('returns mapped rows sorted by trigger', async () => {
    mockTemplates({ 'activity.joined': templateRow() });
    const rows = await listTemplates();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: 'activity.joined',
      title: 'Welcome!',
      enabled: true,
    });
  });
});

describe('updateTemplate', () => {
  it('patches copy fields and stamps edit time', async () => {
    mockTemplates({ 'activity.joined': templateRow() });
    const row = await updateTemplate(
      'activity.joined',
      { title: 'Hi!', enabled: false },
      'admin-1',
    );
    expect(row).toMatchObject({ title: 'Hi!', enabled: false });
    expect(row.lastEditedAt).not.toBeNull();
  });

  it('rejects blank copy and wrong types', async () => {
    mockTemplates({ 'activity.joined': templateRow() });
    await expect(updateTemplate('activity.joined', { title: '  ' }, 'admin-1')).rejects.toThrow(
      'title is required',
    );
    await expect(updateTemplate('activity.joined', { enabled: 'yes' }, 'admin-1')).rejects.toThrow(
      'enabled must be a boolean',
    );
    await expect(updateTemplate('activity.joined', {}, 'admin-1')).rejects.toThrow(
      'No updatable template fields provided',
    );
  });

  it('throws for missing template', async () => {
    mockTemplates({});
    await expect(updateTemplate('ghost', { title: 'Hi' }, 'admin-1')).rejects.toThrow(
      'Template not found',
    );
  });

  it('logs the copy change with before/after state', async () => {
    mockTemplates({ 'activity.joined': templateRow() });
    await updateTemplate('activity.joined', { title: 'Hi!' }, 'admin-1', 'admin@x.com');
    expect(logAdminAction).toHaveBeenCalledWith(
      expect.objectContaining({
        category: 'Templates',
        action: 'template.update',
        adminUid: 'admin-1',
        adminEmail: 'admin@x.com',
        targetId: 'activity.joined',
        after: { title: 'Hi!' },
      }),
    );
  });
});
