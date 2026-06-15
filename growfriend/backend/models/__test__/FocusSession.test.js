const mongoose = require('mongoose');
const FocusSession = require('../FocusSession');

const userId = new mongoose.Types.ObjectId();

describe('FocusSession model', () => {
  it('creates a valid session with correct defaults', async () => {
    const session = await FocusSession.create({ userId });
    expect(session.status).toBe('RUNNING');
    expect(session.plannedDurationSec).toBe(1500);
    expect(session.rewardCoins).toBe(0);
    expect(session.endedAt).toBeNull();
    expect(session.actualDurationSec).toBeNull();
    expect(session.rewardedAt).toBeNull();
    expect(session.startedAt).toBeDefined();
  });

  it('rejects missing userId', async () => {
    await expect(new FocusSession({}).validate()).rejects.toThrow();
  });

  it('rejects an invalid status enum', async () => {
    await expect(new FocusSession({ userId, status: 'PAUSED' }).validate()).rejects.toThrow();
  });

  it('accepts all valid statuses', async () => {
    for (const status of ['RUNNING', 'COMPLETED', 'CANCELLED']) {
      await expect(new FocusSession({ userId, status }).validate()).resolves.toBeUndefined();
    }
  });

  it('stores a custom plannedDurationSec', async () => {
    const session = await FocusSession.create({ userId, plannedDurationSec: 3000 });
    expect(session.plannedDurationSec).toBe(3000);
  });
});
