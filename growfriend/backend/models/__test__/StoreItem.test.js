const StoreItem = require('../StoreItem');

const VALID = {
  code: 'apple',
  name: 'Apple',
  type: 'FOOD',
  price: 10,
  growthValue: 5
};

describe('StoreItem model', () => {
  it('creates a valid store item and uppercases the code', async () => {
    const item = await StoreItem.create(VALID);
    expect(item.code).toBe('APPLE');
    expect(item.price).toBe(10);
    expect(item.growthValue).toBe(5);
  });

  it.each(['code', 'name', 'type', 'price'])('rejects missing required field: %s', async (field) => {
    const { [field]: _omit, ...data } = VALID;
    await expect(new StoreItem(data).validate()).rejects.toThrow();
  });

  it('rejects an invalid type enum', async () => {
    await expect(new StoreItem({ ...VALID, type: 'WEAPON' }).validate()).rejects.toThrow();
  });

  it('rejects price below 0', async () => {
    await expect(new StoreItem({ ...VALID, price: -1 }).validate()).rejects.toThrow();
  });

  it('rejects duplicate code', async () => {
    await StoreItem.create(VALID);
    await expect(StoreItem.create({ ...VALID, name: 'Another Apple' })).rejects.toMatchObject({ code: 11000 });
  });

  it('accepts EGG type without growthValue', async () => {
    const item = new StoreItem({ code: 'EGG_ONE', name: 'Rare Egg', type: 'EGG', price: 50 });
    await expect(item.validate()).resolves.toBeUndefined();
  });
});
