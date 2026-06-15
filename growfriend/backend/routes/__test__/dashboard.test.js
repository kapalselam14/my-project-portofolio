const request = require('supertest');
const app = require('../../app');
const { createTestUser, seedStoreItem } = require('../../test/helpers');
const UserPet = require('../../models/UserPet');

describe('GET /api/dashboard', () => {
  it('returns userSummary, activePetSummary, and storeFlags', async () => {
    const { token } = await createTestUser();
    const res = await request(app).get('/api/dashboard').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.userSummary.email).toBe('test@aucklanduni.ac.nz');
    expect(res.body.data.userSummary.coins).toBe(30);
    expect(res.body.data.userSummary.roles).toContain('USER');
    expect(res.body.data.activePetSummary).not.toBeNull();
    expect(res.body.data.storeFlags).toBeDefined();
  });

  it('returns active pet at EGG stage for a new user', async () => {
    const { token } = await createTestUser();
    const res = await request(app).get('/api/dashboard').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.activePetSummary.stage).toBe('EGG');
    expect(res.body.data.activePetSummary.level).toBe(1);
    expect(res.body.data.activePetSummary.speciesCode).toBe('KIWI');
  });

  it('reports eggUnlocked=false when active pet is not ADULT level 10', async () => {
    const { token } = await createTestUser();
    await seedStoreItem({ code: 'RANDOM_EGG', name: 'Random Egg', type: 'EGG', price: 50 });

    const res = await request(app).get('/api/dashboard').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.storeFlags.randomEgg.eggUnlocked).toBe(false);
  });

  it('reports eggUnlocked=true when active pet is ADULT level 10', async () => {
    const { pet, token } = await createTestUser();
    await UserPet.findByIdAndUpdate(pet._id, { stage: 'ADULT', level: 10 });
    await seedStoreItem({ code: 'RANDOM_EGG', name: 'Random Egg', type: 'EGG', price: 50 });

    const res = await request(app).get('/api/dashboard').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.storeFlags.randomEgg.eggUnlocked).toBe(true);
  });

  it('returns activePetSummary as null when user has no active pet', async () => {
    const { user, pet, token } = await createTestUser();
    // Must clear both the pet status AND the user's activePetId pointer;
    // the dashboard uses activePetId as its primary lookup.
    const User = require('../../models/User');
    await UserPet.findByIdAndUpdate(pet._id, { status: 'INVENTORY' });
    await User.findByIdAndUpdate(user._id, { activePetId: null });

    const res = await request(app).get('/api/dashboard').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.activePetSummary).toBeNull();
  });

  it('returns 401 without a token', async () => {
    const res = await request(app).get('/api/dashboard');
    expect(res.status).toBe(401);
  });
});
