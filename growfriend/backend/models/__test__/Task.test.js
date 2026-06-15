const mongoose = require('mongoose');
const Task = require('../Task');

const createdBy = new mongoose.Types.ObjectId();

const VALID = {
  type: 'PERSONAL',
  createdBy,
  title: 'Clean the kitchen'
};

describe('Task model', () => {
  it('creates a valid task with correct defaults', async () => {
    const task = await Task.create(VALID);
    expect(task.status).toBe('OPEN');
    expect(task.visibility).toBe('PUBLIC');
    expect(task.rewardCoins).toBe(0);
    expect(task.requiresApplication).toBe(false);
    expect(task.description).toBe('');
    expect(task.objectives).toEqual([]);
  });

  it.each(['type', 'createdBy', 'title'])('rejects missing required field: %s', async (field) => {
    const { [field]: _omit, ...data } = VALID;
    await expect(new Task(data).validate()).rejects.toThrow();
  });

  it('rejects an invalid type enum', async () => {
    await expect(new Task({ ...VALID, type: 'INVALID' }).validate()).rejects.toThrow();
  });

  it('rejects an invalid status enum', async () => {
    await expect(new Task({ ...VALID, status: 'UNKNOWN' }).validate()).rejects.toThrow();
  });

  it('rejects an invalid visibility enum', async () => {
    await expect(new Task({ ...VALID, visibility: 'SECRET' }).validate()).rejects.toThrow();
  });

  it('rejects negative rewardCoins', async () => {
    await expect(new Task({ ...VALID, rewardCoins: -1 }).validate()).rejects.toThrow();
  });

  it('accepts all valid task types', async () => {
    for (const type of ['SYSTEM', 'PERSONAL', 'P2P']) {
      await expect(new Task({ ...VALID, type }).validate()).resolves.toBeUndefined();
    }
  });

  it('accepts all valid statuses', async () => {
    const statuses = ['OPEN', 'IN_PROGRESS', 'PENDING_CONFIRMATION', 'COMPLETED', 'CANCELLED', 'DISPUTED', 'CLOSED'];
    for (const status of statuses) {
      await expect(new Task({ ...VALID, status }).validate()).resolves.toBeUndefined();
    }
  });
});
