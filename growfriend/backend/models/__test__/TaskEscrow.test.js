const mongoose = require('mongoose');
const TaskEscrow = require('../TaskEscrow');

const taskId = new mongoose.Types.ObjectId();
const payerUserId = new mongoose.Types.ObjectId();

const VALID = { taskId, payerUserId, amount: 50 };

describe('TaskEscrow model', () => {
  it('creates a valid escrow with correct defaults', async () => {
    const escrow = await TaskEscrow.create(VALID);
    expect(escrow.status).toBe('HELD');
    expect(escrow.payeeUserId).toBeNull();
    expect(escrow.releasedAt).toBeNull();
    expect(escrow.paidOutAt).toBeNull();
    expect(escrow.refundedAt).toBeNull();
  });

  it.each(['taskId', 'payerUserId', 'amount'])('rejects missing required field: %s', async (field) => {
    const { [field]: _omit, ...data } = VALID;
    await expect(new TaskEscrow(data).validate()).rejects.toThrow();
  });

  it('rejects an invalid status enum', async () => {
    await expect(new TaskEscrow({ ...VALID, status: 'PENDING' }).validate()).rejects.toThrow();
  });

  it('rejects amount below 0', async () => {
    await expect(new TaskEscrow({ ...VALID, amount: -10 }).validate()).rejects.toThrow();
  });

  it('accepts zero amount', async () => {
    await expect(new TaskEscrow({ ...VALID, amount: 0 }).validate()).resolves.toBeUndefined();
  });

  it('accepts all valid statuses', async () => {
    for (const status of ['HELD', 'RELEASED', 'PAID_OUT', 'REFUNDED']) {
      await expect(new TaskEscrow({ ...VALID, status }).validate()).resolves.toBeUndefined();
    }
  });
});
