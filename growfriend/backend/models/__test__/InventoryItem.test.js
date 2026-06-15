const mongoose = require('mongoose');
const InventoryItem = require('../InventoryItem');

const userId = new mongoose.Types.ObjectId();
const storeItemId = new mongoose.Types.ObjectId();

const VALID = { userId, storeItemId, quantity: 3 };

describe('InventoryItem model', () => {
  it('creates a valid inventory item', async () => {
    const item = await InventoryItem.create(VALID);
    expect(item.quantity).toBe(3);
    expect(item.userId.toString()).toBe(userId.toString());
  });

  it('quantity defaults to 0', async () => {
    const item = await InventoryItem.create({ userId, storeItemId });
    expect(item.quantity).toBe(0);
  });

  it('rejects quantity below 0', async () => {
    await expect(new InventoryItem({ userId, storeItemId, quantity: -1 }).validate()).rejects.toThrow();
  });

  it('enforces unique (userId, storeItemId) pair', async () => {
    await InventoryItem.create(VALID);
    await expect(InventoryItem.create(VALID)).rejects.toMatchObject({ code: 11000 });
  });

  it('allows same user to own different items', async () => {
    await InventoryItem.create(VALID);
    const anotherItem = new mongoose.Types.ObjectId();
    await expect(InventoryItem.create({ userId, storeItemId: anotherItem, quantity: 1 })).resolves.toBeDefined();
  });

  it.each(['userId', 'storeItemId'])('rejects missing required field: %s', async (field) => {
    const { [field]: _omit, ...data } = VALID;
    await expect(new InventoryItem(data).validate()).rejects.toThrow();
  });
});
