import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const collection = vi.fn();
  const collectionGroup = vi.fn();
  return {
    collection,
    collectionGroup,
    cover: vi.fn(),
    haversine: vi.fn(),
    listSwipes: vi.fn(),
  };
});

vi.mock('../../database/firebase.js', () => ({
  firestore: { collection: mocks.collection, collectionGroup: mocks.collectionGroup },
  auth: {},
  rtdb: {},
}));

vi.mock('./geohash.js', () => ({
  geohashCover: mocks.cover,
  haversineKm: mocks.haversine,
}));

vi.mock('../swipes/swipes.service.js', () => ({
  listSwipeDecisions: mocks.listSwipes,
}));

import { listDiscoverActivities } from './discover.service.js';

const baseAct = (overrides: Record<string, unknown> = {}) => ({
  activityId: 'a-1',
  hostId: 'h-1',
  title: 'Pickup basketball',
  sportType: 'Basketball',
  description: 'casual run',
  locationName: 'Auckland Domain',
  latitude: -36.86,
  longitude: 174.77,
  geohash: 'rckq31v',
  startTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  skillLevel: 'intermediate',
  capacity: 10,
  participantCount: 4,
  status: 'open',
  createdAt: { toMillis: () => 1 },
  updatedAt: { toMillis: () => 1 },
  hostProfile: null,
  mySwipeDecision: null,
  isParticipant: false,
  isHost: false,
  ...overrides,
});

const buildQueryChain = () => {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  chain.where = vi.fn().mockReturnValue(chain);
  chain.limit = vi.fn().mockReturnValue(chain);
  chain.get = vi.fn();
  return chain;
};

let chain: ReturnType<typeof buildQueryChain>;

beforeEach(() => {
  vi.clearAllMocks();
  chain = buildQueryChain();
  mocks.collection.mockReturnValue(chain);
  mocks.collectionGroup.mockReturnValue({
    where: vi.fn().mockReturnValue({
      get: vi.fn().mockResolvedValue({ docs: [] }),
    }),
  });
  mocks.cover.mockReturnValue([]);
  mocks.haversine.mockReturnValue(0);
  mocks.listSwipes.mockResolvedValue([]);
});

describe('listDiscoverActivities', () => {
  it('does not touch the geo pipeline when no near/cover requested', async () => {
    chain.get.mockResolvedValue({
      docs: [
        {
          id: 'a-1',
          data: () => baseAct(),
        },
      ],
    });

    const out = await listDiscoverActivities({
      limit: 10,
      viewerUid: 'u-1',
      discover: { sportFilters: [] },
    });

    expect(out).toHaveLength(1);
    expect(mocks.cover).not.toHaveBeenCalled();
    expect(mocks.listSwipes).toHaveBeenCalledWith('u-1');
  });

  it('excludes activities the viewer has already swiped on', async () => {
    mocks.listSwipes.mockResolvedValue([
      {
        swipeId: 's-1',
        uid: 'u-1',
        activityId: 'a-1',
        decision: 'pass',
        createdAt: { toMillis: () => 1 },
        updatedAt: { toMillis: () => 1 },
      },
    ] as never);
    chain.get.mockResolvedValue({
      docs: [
        { id: 'a-1', data: () => baseAct({ activityId: 'a-1' }) },
        { id: 'a-2', data: () => baseAct({ activityId: 'a-2', title: 'Run' }) },
      ],
    });

    const out = await listDiscoverActivities({
      limit: 10,
      viewerUid: 'u-1',
      discover: { sportFilters: [] },
    });

    expect(out.map((a) => a.activityId)).toEqual(['a-2']);
  });

  it('honors sport+skill filters', async () => {
    chain.get.mockResolvedValue({
      docs: [
        { id: 'a-bb', data: () => baseAct({ activityId: 'a-bb', sportType: 'Basketball' }) },
        { id: 'a-tn', data: () => baseAct({ activityId: 'a-tn', sportType: 'Tennis' }) },
      ],
    });

    const out = await listDiscoverActivities({
      limit: 10,
      viewerUid: 'u-1',
      discover: { sportFilters: [{ sport: 'Tennis', skill: 'any' }] },
    });

    expect(out.map((a) => a.activityId)).toEqual(['a-tn']);
  });

  it('excludes join decisions even when includeSwiped is set', async () => {
    mocks.listSwipes.mockResolvedValue([
      {
        swipeId: 's-1',
        uid: 'u-1',
        activityId: 'a-joined',
        decision: 'join',
        createdAt: { toMillis: () => 1 },
        updatedAt: { toMillis: () => 1 },
      },
      {
        swipeId: 's-2',
        uid: 'u-1',
        activityId: 'a-passed',
        decision: 'pass',
        createdAt: { toMillis: () => 1 },
        updatedAt: { toMillis: () => 1 },
      },
    ] as never);
    chain.get.mockResolvedValue({
      docs: [
        { id: 'a-joined', data: () => baseAct({ activityId: 'a-joined' }) },
        { id: 'a-passed', data: () => baseAct({ activityId: 'a-passed' }) },
      ],
    });

    const out = await listDiscoverActivities({
      limit: 10,
      viewerUid: 'u-1',
      discover: { sportFilters: [], includeSwiped: true },
    });

    // Passes come back via "Start over"; joins never do.
    expect(out.map((a) => a.activityId)).toEqual(['a-passed']);
    expect(mocks.listSwipes).toHaveBeenCalledWith('u-1');
  });

  it('excludes activities the viewer hosts', async () => {
    chain.get.mockResolvedValue({
      docs: [
        { id: 'mine', data: () => baseAct({ activityId: 'mine', hostId: 'u-1' }) },
        { id: 'theirs', data: () => baseAct({ activityId: 'theirs', hostId: 'someone-else' }) },
      ],
    });

    const out = await listDiscoverActivities({
      limit: 10,
      viewerUid: 'u-1',
      discover: { sportFilters: [] },
    });

    expect(out.map((a) => a.activityId)).toEqual(['theirs']);
  });

  it('excludes full activities even when status is still open', async () => {
    chain.get.mockResolvedValue({
      docs: [
        {
          id: 'full',
          data: () =>
            baseAct({ activityId: 'full', participantCount: 10, capacity: 10, status: 'open' }),
        },
        {
          id: 'room',
          data: () =>
            baseAct({ activityId: 'room', participantCount: 9, capacity: 10, status: 'open' }),
        },
      ],
    });

    const out = await listDiscoverActivities({
      limit: 10,
      viewerUid: 'u-1',
      discover: { sportFilters: [] },
    });

    expect(out.map((a) => a.activityId)).toEqual(['room']);
  });

  it('keeps passed activities when includeSwiped is set (lookup still runs to drop joins)', async () => {
    mocks.listSwipes.mockResolvedValue([
      {
        swipeId: 's-1',
        uid: 'u-1',
        activityId: 'a-1',
        decision: 'pass',
        createdAt: { toMillis: () => 1 },
        updatedAt: { toMillis: () => 1 },
      },
    ] as never);
    chain.get.mockResolvedValue({
      docs: [{ id: 'a-1', data: () => baseAct({ activityId: 'a-1' }) }],
    });

    const out = await listDiscoverActivities({
      limit: 10,
      viewerUid: 'u-1',
      discover: { sportFilters: [], includeSwiped: true },
    });

    // Passed card survives; the swipe lookup still runs because it is needed to tell passes apart from joins.
    expect(out.map((a) => a.activityId)).toEqual(['a-1']);
    expect(mocks.listSwipes).toHaveBeenCalledWith('u-1');
  });

  it('ranks preferred sport + closest match first', async () => {
    mocks.cover.mockReturnValue(['rckq31v']);
    mocks.haversine.mockImplementation((_la, _lo, lat) => (lat < -36.86 ? 5 : 2));
    chain.get.mockResolvedValue({
      docs: [
        {
          id: 'far',
          data: () => baseAct({ activityId: 'far', sportType: 'Tennis', latitude: -36.9 }),
        },
        {
          id: 'near',
          data: () => baseAct({ activityId: 'near', sportType: 'Basketball', latitude: -36.86 }),
        },
      ],
    });

    const out = await listDiscoverActivities({
      limit: 10,
      viewerUid: 'u-1',
      discover: {
        sportFilters: [{ sport: 'Basketball', skill: 'intermediate' }],
        near: { latitude: -36.86, longitude: 174.77, radiusKm: 30 },
      },
    });

    expect(out.map((a) => a.activityId)).toEqual(['near']);
  });

  it('excludes activities that already ended (explicit endTime)', async () => {
    const past = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const future = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    chain.get.mockResolvedValue({
      docs: [
        { id: 'old', data: () => baseAct({ activityId: 'old', startTime: past, endTime: past }) },
        {
          id: 'live',
          data: () => baseAct({ activityId: 'live', startTime: future, endTime: future }),
        },
      ],
    });

    const out = await listDiscoverActivities({
      limit: 10,
      viewerUid: 'u-1',
      discover: { sportFilters: [] },
    });

    expect(out.map((a) => a.activityId)).toEqual(['live']);
  });

  it('excludes activities past startTime + 2h fallback when endTime is missing', async () => {
    const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
    const future = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    chain.get.mockResolvedValue({
      docs: [
        { id: 'stale', data: () => baseAct({ activityId: 'stale', startTime: threeHoursAgo }) },
        { id: 'live', data: () => baseAct({ activityId: 'live', startTime: future }) },
      ],
    });

    const out = await listDiscoverActivities({
      limit: 10,
      viewerUid: 'u-1',
      discover: { sportFilters: [] },
    });

    expect(out.map((a) => a.activityId)).toEqual(['live']);
  });

  it('excludes games that started but have not ended yet', async () => {
    // Started 30 min ago, ends in 90 min: the end-gate passes but the join would 409 ("already started").
    const started = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const endsSoon = new Date(Date.now() + 90 * 60 * 1000).toISOString();
    const future = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    chain.get.mockResolvedValue({
      docs: [
        {
          id: 'live-now',
          data: () => baseAct({ activityId: 'live-now', startTime: started, endTime: endsSoon }),
        },
        { id: 'live', data: () => baseAct({ activityId: 'live', startTime: future }) },
      ],
    });

    const out = await listDiscoverActivities({
      limit: 10,
      viewerUid: 'u-1',
      discover: { sportFilters: [] },
    });

    expect(out.map((a) => a.activityId)).toEqual(['live']);
  });

  it('excludes activities the viewer joined without swiping', async () => {
    mocks.collectionGroup.mockReturnValue({
      where: vi.fn().mockReturnValue({
        get: vi.fn().mockResolvedValue({
          docs: [{ ref: { path: 'activities/a-joined/participants/u-1' } }],
        }),
      }),
    });
    chain.get.mockResolvedValue({
      docs: [
        { id: 'a-joined', data: () => baseAct({ activityId: 'a-joined' }) },
        { id: 'a-open', data: () => baseAct({ activityId: 'a-open' }) },
      ],
    });

    const out = await listDiscoverActivities({
      limit: 10,
      viewerUid: 'u-1',
      discover: { sportFilters: [] },
    });

    expect(out.map((a) => a.activityId)).toEqual(['a-open']);
  });

  it('carries joinPolicy through so cards show NEEDS APPROVAL, not INSTANT JOIN', async () => {
    chain.get.mockResolvedValue({
      docs: [
        {
          id: 'gated',
          data: () => baseAct({ activityId: 'gated', joinPolicy: 'approval' }),
        },
      ],
    });

    const out = await listDiscoverActivities({
      limit: 10,
      viewerUid: 'u-1',
      discover: { sportFilters: [] },
    });

    expect(out).toHaveLength(1);
    expect(out[0].joinPolicy).toBe('approval');
  });

  it('scans the full open set instead of a paginated overscan', async () => {
    // Regression: the old `limit(overscan)` paginated an UNORDERED query before in-memory filtering.
    chain.get.mockResolvedValue({
      docs: [{ id: 'a-1', data: () => baseAct({ activityId: 'a-1' }) }],
    });

    const out = await listDiscoverActivities({
      limit: 10,
      viewerUid: 'u-1',
      discover: { sportFilters: [{ sport: 'Basketball', skill: 'any' }] },
    });

    expect(chain.limit).toHaveBeenCalledWith(500);
    expect(out.map((a) => a.activityId)).toEqual(['a-1']);
  });
});
