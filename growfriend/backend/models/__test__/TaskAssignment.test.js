const mongoose = require('mongoose');
const TaskAssignment = require('../TaskAssignment');

const taskId = new mongoose.Types.ObjectId();
const assignedTo = new mongoose.Types.ObjectId();

const VALID = { taskId, assignedTo };

describe('TaskAssignment model', () => {
  it('creates a valid assignment with correct defaults', async () => {
    const assignment = await TaskAssignment.create(VALID);
    expect(assignment.status).toBe('ASSIGNED');
    expect(assignment.checkInAt).toBeNull();
    expect(assignment.checkOutAt).toBeNull();
    expect(assignment.completedAt).toBeNull();
    expect(assignment.assignedBy).toBeNull();
  });

  it.each(['taskId', 'assignedTo'])('rejects missing required field: %s', async (field) => {
    const { [field]: _omit, ...data } = VALID;
    await expect(new TaskAssignment(data).validate()).rejects.toThrow();
  });

  it('rejects an invalid status enum', async () => {
    await expect(new TaskAssignment({ ...VALID, status: 'PENDING' }).validate()).rejects.toThrow();
  });

  it('accepts all valid statuses', async () => {
    const statuses = ['ASSIGNED', 'CHECKED_IN', 'CHECKED_OUT', 'DONE_PENDING_CONFIRMATION', 'COMPLETED', 'CANCELLED', 'DISPUTED'];
    for (const status of statuses) {
      await expect(new TaskAssignment({ ...VALID, status }).validate()).resolves.toBeUndefined();
    }
  });
});
