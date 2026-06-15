const mongoose = require('mongoose');
const CoinTransaction = require('../CoinTransaction');

const userId = new mongoose.Types.ObjectId();

const VALID = {
  userId,
  amount: 30,
  balanceAfter: 30,
  type: 'INITIAL_GRANT'
};

describe('CoinTransaction model', () => {
  it('creates a valid transaction with correct defaults', async () => {
    const tx = await CoinTransaction.create(VALID);
    expect(tx.userId.toString()).toBe(userId.toString());
    expect(tx.amount).toBe(30);
    expect(tx.relatedModel).toBeNull();
    expect(tx.relatedId).toBeNull();
    expect(tx.note).toBeNull();
  });

  it.each(['userId', 'amount', 'balanceAfter', 'type'])(
    'rejects missing required field: %s',
    async (field) => {
      const { [field]: _omit, ...data } = VALID;
      await expect(new CoinTransaction(data).validate()).rejects.toThrow();
    }
  );

  it('rejects an invalid type enum', async () => {
    await expect(new CoinTransaction({ ...VALID, type: 'GIFT' }).validate()).rejects.toThrow();
  });

  it('rejects negative balanceAfter', async () => {
    await expect(new CoinTransaction({ ...VALID, balanceAfter: -1 }).validate()).rejects.toThrow();
  });

  it('accepts negative amount (debit)', async () => {
    await expect(new CoinTransaction({ ...VALID, amount: -10 }).validate()).resolves.toBeUndefined();
  });

  it('accepts all valid transaction types', async () => {
    const types = [
      'INITIAL_GRANT', 'FOCUS_REWARD', 'STORE_PURCHASE', 'TASK_REWARD',
      'ESCROW_HOLD', 'ESCROW_RELEASE', 'ESCROW_PAYOUT', 'ESCROW_REFUND', 'ADMIN_ADJUSTMENT'
    ];
    for (const type of types) {
      await expect(new CoinTransaction({ ...VALID, type }).validate()).resolves.toBeUndefined();
    }
  });
});
