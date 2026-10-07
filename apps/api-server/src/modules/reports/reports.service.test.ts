import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../database/firebase.js', () => {
  return {
    firestore: {
      doc: vi.fn(),
      collection: vi.fn(),
    },
  };
});

vi.mock('../admin/audit.service.js', () => ({
  logAdminAction: vi.fn(),
}));

import { firestore } from '../../database/firebase.js';
import { logAdminAction } from '../admin/audit.service.js';
import {
  dismissReport,
  listReports,
  reportCategoryForReason,
  resolveReport,
  submitReport,
} from './reports.service.js';

function mockTargetExists(exists: boolean) {
  vi.mocked(firestore.doc).mockReturnValue({
    get: async () => ({ exists }),
  } as never);
}

function mockAdd(reportId = 'report-1') {
  const add = vi.fn().mockResolvedValue({ id: reportId });
  vi.mocked(firestore.collection).mockReturnValue({ add } as never);
  return add;
}

const baseInput = {
  reporterId: 'reporter-1',
  targetId: 'activity-1',
  targetType: 'activity' as const,
  reason: 'Spam / Fake activity',
};

describe('reports service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTargetExists(true);
    mockAdd();
  });

  it('stores a pending report and returns its id', async () => {
    const add = mockAdd('report-9');

    const result = await submitReport({ ...baseInput, details: 'Copy-pasted' });

    expect(result).toEqual({ reportId: 'report-9', autoHidden: false });
    expect(firestore.collection).toHaveBeenCalledWith('reports');
    expect(add).toHaveBeenCalledOnce();
    const record = vi.mocked(add).mock.calls[0][0] as Record<string, unknown>;
    expect(record).toMatchObject({
      reporterId: 'reporter-1',
      targetId: 'activity-1',
      targetType: 'activity',
      reason: 'Spam / Fake activity',
      details: 'Copy-pasted',
      status: 'pending',
    });
    expect(record.createdAt).toBeDefined();
  });

  it('omits details when blank', async () => {
    const add = mockAdd();

    await submitReport({ ...baseInput, details: '   ' });

    const record = vi.mocked(add).mock.calls[0][0] as Record<string, unknown>;
    expect(record).not.toHaveProperty('details');
  });

  it('stores evidenceUrls when given', async () => {
    const add = mockAdd();

    await submitReport({
      ...baseInput,
      evidenceUrls: ['https://example.com/a.jpg', 'https://example.com/b.jpg'],
    });

    const record = vi.mocked(add).mock.calls[0][0] as Record<string, unknown>;
    expect(record.evidenceUrls).toEqual(['https://example.com/a.jpg', 'https://example.com/b.jpg']);
  });

  it('omits evidenceUrls when the array is empty or blank-only', async () => {
    const add = mockAdd();

    await submitReport({ ...baseInput, evidenceUrls: ['   '] });

    const record = vi.mocked(add).mock.calls[0][0] as Record<string, unknown>;
    expect(record).not.toHaveProperty('evidenceUrls');
  });

  it('rejects more than 3 evidenceUrls', async () => {
    await expect(
      submitReport({
        ...baseInput,
        evidenceUrls: ['a', 'b', 'c', 'd'].map((s) => `https://example.com/${s}.jpg`),
      }),
    ).rejects.toThrow('evidenceUrls must be at most 3 items');
  });

  it('rejects an overlong evidence URL', async () => {
    await expect(
      submitReport({
        ...baseInput,
        evidenceUrls: [`https://example.com/${'x'.repeat(2000)}.jpg`],
      }),
    ).rejects.toThrow('evidence URL must be at most 2000 characters');
  });

  it('checks the activity document for activity targets', async () => {
    mockTargetExists(true);

    await submitReport(baseInput);

    expect(firestore.doc).toHaveBeenCalledWith('activities/activity-1');
  });

  it('checks the user document for user targets', async () => {
    mockTargetExists(true);

    await submitReport({ ...baseInput, targetId: 'user-2', targetType: 'user' });

    expect(firestore.doc).toHaveBeenCalledWith('users/user-2');
  });

  it('throws Target not found when the target is missing', async () => {
    mockTargetExists(false);

    await expect(submitReport(baseInput)).rejects.toThrow('Target not found');
    expect(firestore.collection).not.toHaveBeenCalled();
  });

  it('rejects self-reports', async () => {
    await expect(
      submitReport({ ...baseInput, targetId: 'reporter-1', targetType: 'user' }),
    ).rejects.toThrow('cannot report yourself');
  });

  it.each([
    { name: 'blank targetId', input: { ...baseInput, targetId: '   ' } },
    { name: 'blank reason', input: { ...baseInput, reason: '   ' } },
    { name: 'blank reporterId', input: { ...baseInput, reporterId: '   ' } },
  ])('rejects $name', async ({ input }) => {
    await expect(submitReport(input)).rejects.toThrow('required');
  });

  it('rejects an invalid targetType', async () => {
    await expect(submitReport({ ...baseInput, targetType: 'group' as never })).rejects.toThrow(
      'targetType must be user or activity',
    );
  });

  it('rejects an overlong reason', async () => {
    await expect(submitReport({ ...baseInput, reason: 'x'.repeat(201) })).rejects.toThrow(
      'at most 200 characters',
    );
  });
});

describe('reportCategoryForReason', () => {
  it.each([
    ['Harassment in chat', 'Harassment'],
    ['Spam / Fake activity', 'Spam'],
    ['Impersonation of host', 'Fraud'],
    ['Inappropriate content', 'Inappropriate Content'],
    ['Misleading information', 'Policy Breach'],
    ['No-show host', 'Policy Breach'],
    ['Something weird', 'Other'],
  ])('maps %s to %s', (reason, expected) => {
    expect(reportCategoryForReason(reason)).toBe(expected);
  });
});

// Activity auto-hide is based on distinct pending reporters; user reports never hide a target.
describe('auto-hide threshold', () => {
  const pendingRow = (reporterId: string, status = 'pending') => ({
    data: () => ({ reporterId, status }),
  });

  function mockReportsWhere(rows: Array<ReturnType<typeof pendingRow>>) {
    const get = vi.fn().mockResolvedValue({ docs: rows });
    const limit = vi.fn().mockReturnValue({ get });
    const where = vi.fn().mockReturnValue({ limit, get });
    vi.mocked(firestore.collection).mockImplementation(((name: string) => {
      if (name === 'reports') {
        return {
          add: vi.fn().mockResolvedValue({ id: 'r-new' }),
          where,
          doc: () => ({
            update: vi.fn().mockResolvedValue(undefined),
          }),
        };
      }
      throw new Error(`unexpected collection: ${name}`);
    }) as never);
  }

  function mockActivityDoc(status = 'open') {
    const update = vi.fn().mockResolvedValue(undefined);
    vi.mocked(firestore.doc).mockImplementation(((path: string) => {
      if (path.startsWith('activities/')) {
        return {
          get: async () => ({ exists: true, data: () => ({ status }) }),
          update,
        };
      }
      return { get: async () => ({ exists: true, data: () => ({}) }) };
    }) as never);
    return update;
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('hides the activity on the 3rd distinct reporter', async () => {
    mockReportsWhere([pendingRow('u-1'), pendingRow('u-2'), pendingRow('u-3')]);
    const update = mockActivityDoc('open');

    const result = await submitReport({ ...baseInput });

    expect(result.autoHidden).toBe(true);
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ status: 'removed' }));
  });

  it('does not hide below the threshold', async () => {
    mockReportsWhere([pendingRow('u-1'), pendingRow('u-2')]);
    const update = mockActivityDoc('open');

    const result = await submitReport({ ...baseInput });

    expect(result.autoHidden).toBe(false);
    expect(update).not.toHaveBeenCalled();
  });

  it('counts distinct reporters (dupes do not stack)', async () => {
    mockReportsWhere([pendingRow('u-1'), pendingRow('u-1'), pendingRow('u-2')]);
    const update = mockActivityDoc('open');

    const result = await submitReport({ ...baseInput });

    expect(result.autoHidden).toBe(false);
    expect(update).not.toHaveBeenCalled();
  });

  it('does not count resolved reports toward the auto-hide threshold', async () => {
    mockReportsWhere([
      pendingRow('u-1'),
      pendingRow('u-2'),
      pendingRow('u-3', 'resolved'),
    ]);
    const update = mockActivityDoc('open');

    const result = await submitReport({ ...baseInput });

    expect(result.autoHidden).toBe(false);
    expect(update).not.toHaveBeenCalled();
  });

  it('keeps a report successful when the best-effort auto-hide query fails', async () => {
    mockTargetExists(true);
    const add = vi.fn().mockResolvedValue({ id: 'report-saved' });
    vi.mocked(firestore.collection).mockImplementation(((name: string) => {
      if (name !== 'reports') throw new Error(`unexpected collection: ${name}`);
      return {
        add,
        where: () => ({ get: vi.fn().mockRejectedValue(new Error('query unavailable')) }),
      } as never;
    }) as never);

    await expect(submitReport({ ...baseInput })).resolves.toEqual({
      reportId: 'report-saved',
      autoHidden: false,
    });
    expect(add).toHaveBeenCalledOnce();
  });

  it('never auto-hides user targets', async () => {
    mockReportsWhere([pendingRow('u-1'), pendingRow('u-2'), pendingRow('u-3'), pendingRow('u-4')]);
    const update = mockActivityDoc('open');

    const result = await submitReport({
      ...baseInput,
      targetId: 'user-9',
      targetType: 'user',
    });

    expect(result.autoHidden).toBe(false);
    expect(update).not.toHaveBeenCalled();
  });
});

describe('triage actions', () => {
  function mockTransaction(status: string) {
    const update = vi.fn();
    const runTransaction = vi.fn(async (fn: (tx: unknown) => Promise<void>) => {
      await fn({
        get: async () =>
          status === 'missing' ? { exists: false } : { exists: true, data: () => ({ status }) },
        update,
      });
    });
    return { runTransaction, update };
  }

  function mockTx(firestoreMock: { runTransaction: unknown }) {
    vi.mocked(firestore.collection).mockReturnValue({
      doc: () => ({
        runTransaction: firestoreMock.runTransaction,
      }),
    } as never);
    // Service calls firestore.runTransaction directly.
    (firestore as unknown as Record<string, unknown>).runTransaction = firestoreMock.runTransaction;
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('resolveReport flips pending to resolved with note', async () => {
    const { runTransaction, update } = mockTransaction('pending');
    mockTx({ runTransaction });

    await resolveReport({
      reportId: 'r-1',
      adminUid: 'admin-1',
      note: 'User warned',
    });

    expect(update.mock.calls[0][1]).toMatchObject({
      status: 'resolved',
      adminNote: 'User warned',
      resolvedBy: 'admin-1',
    });
  });

  it('dismissReport flips pending to dismissed', async () => {
    const { runTransaction, update } = mockTransaction('pending');
    mockTx({ runTransaction });

    await dismissReport({ reportId: 'r-2', adminUid: 'admin-1' });

    expect(update.mock.calls[0][1]).toMatchObject({ status: 'dismissed' });
  });

  it('logs the triage decision', async () => {
    const { runTransaction } = mockTransaction('pending');
    mockTx({ runTransaction });

    await resolveReport({ reportId: 'r-1', adminUid: 'admin-1', note: 'Warned' });

    expect(logAdminAction).toHaveBeenCalledWith(
      expect.objectContaining({
        category: 'Reports',
        action: 'report.resolve',
        adminUid: 'admin-1',
        targetId: 'r-1',
        before: { status: 'pending' },
        after: { status: 'resolved', adminNote: 'Warned' },
      }),
    );
  });

  it('rejects triage of an already-triaged report', async () => {
    const { runTransaction } = mockTransaction('resolved');
    mockTx({ runTransaction });

    await expect(resolveReport({ reportId: 'r-3', adminUid: 'admin-1' })).rejects.toThrow(
      'Report is no longer pending',
    );
  });

  it('rejects triage of a missing report', async () => {
    const { runTransaction } = mockTransaction('missing');
    mockTx({ runTransaction });

    await expect(dismissReport({ reportId: 'nope', adminUid: 'admin-1' })).rejects.toThrow(
      'Report not found',
    );
  });

  it('rejects an overlong admin note', async () => {
    await expect(
      resolveReport({
        reportId: 'r-4',
        adminUid: 'admin-1',
        note: 'x'.repeat(501),
      }),
    ).rejects.toThrow('at most 500 characters');
  });
});

describe('listReports', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns enriched newest-first views', async () => {
    const rows = [
      {
        id: 'r-old',
        data: () => ({
          reporterId: 'u-1',
          targetId: 'a-9',
          targetType: 'activity',
          reason: 'Spam / Fake activity',
          status: 'pending',
          createdAt: { toDate: () => new Date('2026-09-01T10:00:00Z') },
        }),
      },
      {
        id: 'r-new',
        data: () => ({
          reporterId: 'u-2',
          targetId: 'u-3',
          targetType: 'user',
          reason: 'Harassment in chat',
          status: 'pending',
          createdAt: { toDate: () => new Date('2026-09-02T10:00:00Z') },
        }),
      },
    ];
    const get = vi.fn().mockResolvedValue({ docs: rows });
    const limit = vi.fn().mockReturnValue({ get });
    const where = vi.fn().mockReturnValue({ limit });
    vi.mocked(firestore.collection).mockImplementation(((name: string) => {
      if (name === 'reports') return { where, limit };
      throw new Error(`unexpected collection: ${name}`);
    }) as never);
    vi.mocked(firestore.doc).mockImplementation(((path: string) => {
      if (path.startsWith('activities/')) {
        return {
          get: async () => ({
            exists: true,
            data: () => ({
              title: 'Sunday Run',
              sportType: 'Running',
            }),
          }),
        };
      }
      return { get: async () => ({ exists: false }) };
    }) as never);

    // getPublicUserProfile is a real import (users.service) backed
    // by firestore mocks above — displayName resolution is
    // best-effort; raw ids are acceptable fallbacks here.
    const views = await listReports({ status: 'pending' });

    expect(where).toHaveBeenCalledWith('status', '==', 'pending');
    expect(views.map((v) => v.id)).toEqual(['r-new', 'r-old']);
    expect(views[1]).toMatchObject({
      target: 'Sunday Run',
      activityTitle: 'Sunday Run',
      sport: 'Running',
      category: 'Spam',
      status: 'Pending',
    });
    expect(views[0]).toMatchObject({ category: 'Harassment' });
  });

  it('rejects an invalid status filter', async () => {
    await expect(listReports({ status: 'archived' as never })).rejects.toThrow(
      'status must be pending, resolved, or dismissed',
    );
  });
});
