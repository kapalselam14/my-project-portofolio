const request = require('supertest');
const app = require('../../app');
const { createTestUser, seedStoreItem } = require('../../test/helpers');
const User = require('../../models/User');
const UserPet = require('../../models/UserPet');

describe('GET /api/store/items', () => {
  it('returns the list of store items', async () => {
    const { token } = await createTestUser();
    await seedStoreItem({ code: 'APPLE', name: 'Apple', type: 'FOOD', price: 5, growthValue: 20 });

    const res = await request(app).get('/api/store/items').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.items[0].code).toBe('APPLE');
  });

  it('returns an empty list when no store items exist', async () => {
    const { token } = await createTestUser();
    const res = await request(app).get('/api/store/items').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(0);
  });

  it('marks RANDOM_EGG as locked when active pet is not max stage', async () => {
    const { token } = await createTestUser();
    await seedStoreItem({ code: 'RANDOM_EGG', name: 'Random Egg', type: 'EGG', price: 50 });

    const res = await request(app).get('/api/store/items').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const egg = res.body.data.items.find(i => i.code === 'RANDOM_EGG');
    expect(egg.locked).toBe(true);
  });

  it('marks RANDOM_EGG as unlocked when active pet is ADULT level 10', async () => {
    const { user, pet, token } = await createTestUser();
    await UserPet.findByIdAndUpdate(pet._id, { stage: 'ADULT', level: 10 });
    await seedStoreItem({ code: 'RANDOM_EGG', name: 'Random Egg', type: 'EGG', price: 50 });

    const res = await request(app).get('/api/store/items').set('Authorization', `Bearer ${token}`);

    const egg = res.body.data.items.find(i => i.code === 'RANDOM_EGG');
    expect(egg.locked).toBe(false);
  });

  it('returns 401 without a token', async () => {
    const res = await request(app).get('/api/store/items');
    expect(res.status).toBe(401);
  });
});

describe('POST /api/store/purchase', () => {
  it('purchases a FOOD item and adds it to the inventory', async () => {
    const { user, token } = await createTestUser();
    await seedStoreItem({ code: 'APPLE', name: 'Apple', type: 'FOOD', price: 5, growthValue: 20 });
    await User.findByIdAndUpdate(user._id, { coins: 50 });

    const res = await request(app)
      .post('/api/store/purchase')
      .set('Authorization', `Bearer ${token}`)
      .send({ itemCode: 'APPLE', quantity: 2 });

    expect(res.status).toBe(200);
    expect(res.body.data.coins).toBe(40);
    expect(res.body.data.inventoryItem.quantity).toBe(2);
    expect(res.body.data.inventoryItem.itemCode).toBe('APPLE');
  });

  it('defaults quantity to 1 when not specified', async () => {
    const { user, token } = await createTestUser();
    await seedStoreItem({ code: 'APPLE', name: 'Apple', type: 'FOOD', price: 5, growthValue: 20 });
    await User.findByIdAndUpdate(user._id, { coins: 50 });

    const res = await request(app)
      .post('/api/store/purchase')
      .set('Authorization', `Bearer ${token}`)
      .send({ itemCode: 'APPLE' });

    expect(res.status).toBe(200);
    expect(res.body.data.inventoryItem.quantity).toBe(1);
  });

  it('returns 400 when itemCode is missing', async () => {
    const { token } = await createTestUser();
    const res = await request(app)
      .post('/api/store/purchase')
      .set('Authorization', `Bearer ${token}`)
      .send({ quantity: 1 });
    expect(res.status).toBe(400);
  });

  it('returns 400 when quantity is zero or negative', async () => {
    const { token } = await createTestUser();
    await seedStoreItem({ code: 'APPLE', name: 'Apple', type: 'FOOD', price: 5 });
    const res = await request(app)
      .post('/api/store/purchase')
      .set('Authorization', `Bearer ${token}`)
      .send({ itemCode: 'APPLE', quantity: 0 });
    expect(res.status).toBe(400);
  });

  it('returns 404 when the item code does not exist', async () => {
    const { token } = await createTestUser();
    const res = await request(app)
      .post('/api/store/purchase')
      .set('Authorization', `Bearer ${token}`)
      .send({ itemCode: 'GHOST_ITEM', quantity: 1 });
    expect(res.status).toBe(404);
  });

  it('returns 400 when the user has insufficient coins', async () => {
    const { user, token } = await createTestUser();
    await seedStoreItem({ code: 'PRICEY', name: 'Pricey Item', type: 'FOOD', price: 999, growthValue: 1 });
    await User.findByIdAndUpdate(user._id, { coins: 5 });

    const res = await request(app)
      .post('/api/store/purchase')
      .set('Authorization', `Bearer ${token}`)
      .send({ itemCode: 'PRICEY', quantity: 1 });

    expect(res.status).toBe(400);
  });

  it('returns 401 without a token', async () => {
    const res = await request(app).post('/api/store/purchase').send({ itemCode: 'APPLE', quantity: 1 });
    expect(res.status).toBe(401);
  });
});
