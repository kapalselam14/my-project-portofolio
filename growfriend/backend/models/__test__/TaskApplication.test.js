const mongoose = require('mongoose');
const TaskApplication = require('../TaskApplication');

const taskId = new mongoose.Types.ObjectId();
const userId = new mongoose.Types.ObjectId();

const VALID = { taskId, userId };

describe('TaskApplication model', () => {
  it('creates a valid application with correct defaults', async () => {
    const app = await TaskApplication.create(VALID);
    expect(app.status).toBe('PENDING');
    expect(app.decidedAt).toBeNull();
    expect(app.appliedAt).toBeDefined();
  });

  it.each(['taskId', 'userId'])('rejects missing required field: %s', async (field) => {
    const { [field]: _omit, ...data } = VALID;
    await expect(new TaskApplication(data).validate()).rejects.toThrow();
  });

  it('rejects an invalid status enum', async () => {
    await expect(new TaskApplication({ ...VALID, status: 'MAYBE' }).validate()).rejects.toThrow();
  });

  it('enforces unique (taskId, userId) pair', async () => {
    await TaskApplication.create(VALID);
    await expect(TaskApplication.create(VALID)).rejects.toMatchObject({ code: 11000 });
  });

  it('allows same user to apply to different tasks', async () => {
    await TaskApplication.create(VALID);
    const anotherTask = new mongoose.Types.ObjectId();
    await expect(TaskApplication.create({ taskId: anotherTask, userId })).resolves.toBeDefined();
  });

  it('accepts all valid statuses', async () => {
    for (const status of ['PENDING', 'ACCEPTED', 'REJECTED', 'WITHDRAWN']) {
      await expect(new TaskApplication({ ...VALID, status }).validate()).resolves.toBeUndefined();
    }
  });
});
