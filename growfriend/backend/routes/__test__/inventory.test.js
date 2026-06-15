const request = require('supertest');
const app = require('../../app');
const { createTestUser, seedStoreItem, seedInventoryItem } = require('../../test/helpers');

describe('GET /api/inventory', () => {
  it('returns an empty inventory for a new user', async () => {
    const { token } = await createTestUser();
    const res = await request(app).get('/api/inventory').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.items).toHaveLength(0);
  });

  it('returns inventory items with full store item details', async () => {
    const { user, token } = await createTestUser();
    const item = await seedStoreItem({ code: 'APPLE', name: 'Apple', type: 'FOOD', price: 5, growthValue: 20 });
    await seedInventoryItem(user._id, item._id, 5);

    const res = await request(app).get('/api/inventory').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.items[0].itemCode).toBe('APPLE');
    expect(res.body.data.items[0].itemName).toBe('Apple');
    expect(res.body.data.items[0].quantity).toBe(5);
    expect(res.body.data.items[0].growthValue).toBe(20);
  });

  it('returns multiple distinct items', async () => {
    const { user, token } = await createTestUser();
    const apple = await seedStoreItem({ code: 'APPLE', name: 'Apple', type: 'FOOD', price: 5, growthValue: 10 });
    const berry = await seedStoreItem({ code: 'BERRY', name: 'Berry', type: 'FOOD', price: 3, growthValue: 5 });
    await seedInventoryItem(user._id, apple._id, 2);
    await seedInventoryItem(user._id, berry._id, 4);

    const res = await request(app).get('/api/inventory').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(2);
  });

  it('does not return another user\'s inventory items', async () => {
    const { user: user1, token: token1 } = await createTestUser();
    const { user: user2 } = await createTestUser({ email: 'other@aucklanduni.ac.nz' });
    const item = await seedStoreItem({ code: 'APPLE', name: 'Apple', type: 'FOOD', price: 5, growthValue: 20 });
    await seedInventoryItem(user2._id, item._id, 10);

    const res = await request(app).get('/api/inventory').set('Authorization', `Bearer ${token1}`);

    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(0);
  });

  it('returns 401 without a token', async () => {
    const res = await request(app).get('/api/inventory');
    expect(res.status).toBe(401);
  });
});
