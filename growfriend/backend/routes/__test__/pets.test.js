const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../app');
const { createTestUser, seedStoreItem, seedInventoryItem } = require('../../test/helpers');
const UserPet = require('../../models/UserPet');

describe('GET /api/pets/active', () => {
  it('returns the active pet with species info', async () => {
    const { token } = await createTestUser();
    const res = await request(app).get('/api/pets/active').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.activePet.stage).toBe('EGG');
    expect(res.body.data.activePet.level).toBe(1);
    expect(res.body.data.activePet.status).toBe('ACTIVE');
    expect(res.body.data.activePet.speciesCode).toBe('KIWI');
  });

  it('returns 401 without a token', async () => {
    const res = await request(app).get('/api/pets/active');
    expect(res.status).toBe(401);
  });

  it('returns 404 when the user has no active pet', async () => {
    const { pet, token } = await createTestUser();
    await UserPet.findByIdAndUpdate(pet._id, { status: 'INVENTORY' });
    const res = await request(app).get('/api/pets/active').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });
});

describe('GET /api/pets/collection', () => {
  it('returns an empty list when no inactive pets exist', async () => {
    const { token } = await createTestUser();
    const res = await request(app).get('/api/pets/collection').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.pets).toHaveLength(0);
  });

  it('returns INVENTORY pets but not the ACTIVE one', async () => {
    const { user, species, token } = await createTestUser();
    await UserPet.create({ userId: user._id, speciesId: species._id, status: 'INVENTORY' });
    await UserPet.create({ userId: user._id, speciesId: species._id, status: 'INVENTORY' });
    const res = await request(app).get('/api/pets/collection').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.pets).toHaveLength(2);
    expect(res.body.data.pets.every(p => p.status === 'INVENTORY')).toBe(true);
  });

  it('returns 401 without a token', async () => {
    const res = await request(app).get('/api/pets/collection');
    expect(res.status).toBe(401);
  });
});

describe('PATCH /api/pets/active/nickname', () => {
  it('updates the active pet nickname', async () => {
    const { token } = await createTestUser();
    const res = await request(app)
      .patch('/api/pets/active/nickname')
      .set('Authorization', `Bearer ${token}`)
      .send({ nickname: 'Sparky' });
    expect(res.status).toBe(200);
    expect(res.body.data.activePet.nickname).toBe('Sparky');
  });

  it('rejects an empty (whitespace-only) nickname with 400', async () => {
    const { token } = await createTestUser();
    const res = await request(app)
      .patch('/api/pets/active/nickname')
      .set('Authorization', `Bearer ${token}`)
      .send({ nickname: '   ' });
    expect(res.status).toBe(400);
  });

  it('rejects a nickname over 30 characters with 400', async () => {
    const { token } = await createTestUser();
    const res = await request(app)
      .patch('/api/pets/active/nickname')
      .set('Authorization', `Bearer ${token}`)
      .send({ nickname: 'a'.repeat(31) });
    expect(res.status).toBe(400);
  });

  it('rejects a missing nickname field with 400', async () => {
    const { token } = await createTestUser();
    const res = await request(app)
      .patch('/api/pets/active/nickname')
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(400);
  });

  it('returns 401 without a token', async () => {
    const res = await request(app).patch('/api/pets/active/nickname').send({ nickname: 'Sparky' });
    expect(res.status).toBe(401);
  });
});

describe('POST /api/pets/:id/feed', () => {
  it('feeds the pet, applies growth, and decrements inventory', async () => {
    const { user, pet, token } = await createTestUser();
    const item = await seedStoreItem({ code: 'APPLE', type: 'FOOD', price: 5, growthValue: 20 });
    await seedInventoryItem(user._id, item._id, 3);

    const res = await request(app)
      .post(`/api/pets/${pet._id}/feed`)
      .set('Authorization', `Bearer ${token}`)
      .send({ itemCode: 'APPLE' });

    expect(res.status).toBe(200);
    expect(res.body.data.pet.growthPoints).toBe(20);
    expect(res.body.data.inventoryItem.quantity).toBe(2);
  });

  it('returns 400 when itemCode is missing', async () => {
    const { pet, token } = await createTestUser();
    const res = await request(app)
      .post(`/api/pets/${pet._id}/feed`)
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(400);
  });

  it('returns 400 when the pet is evolution-frozen', async () => {
    const { user, pet, token } = await createTestUser();
    await UserPet.findByIdAndUpdate(pet._id, { isGrowthFrozen: true });
    const item = await seedStoreItem({ code: 'APPLE', type: 'FOOD', price: 5, growthValue: 20 });
    await seedInventoryItem(user._id, item._id, 3);

    const res = await request(app)
      .post(`/api/pets/${pet._id}/feed`)
      .set('Authorization', `Bearer ${token}`)
      .send({ itemCode: 'APPLE' });
    expect(res.status).toBe(400);
  });

  it('returns 404 when the pet does not exist', async () => {
    const { token } = await createTestUser();
    const fakeId = new mongoose.Types.ObjectId();
    const res = await request(app)
      .post(`/api/pets/${fakeId}/feed`)
      .set('Authorization', `Bearer ${token}`)
      .send({ itemCode: 'APPLE' });
    expect(res.status).toBe(404);
  });

  it('returns 404 when the store item does not exist', async () => {
    const { pet, token } = await createTestUser();
    const res = await request(app)
      .post(`/api/pets/${pet._id}/feed`)
      .set('Authorization', `Bearer ${token}`)
      .send({ itemCode: 'NONEXISTENT' });
    expect(res.status).toBe(404);
  });

  it('returns 404 when the item is not in the user inventory', async () => {
    const { pet, token } = await createTestUser();
    await seedStoreItem({ code: 'APPLE', type: 'FOOD', price: 5, growthValue: 20 });
    const res = await request(app)
      .post(`/api/pets/${pet._id}/feed`)
      .set('Authorization', `Bearer ${token}`)
      .send({ itemCode: 'APPLE' });
    expect(res.status).toBe(404);
  });

  it('returns 401 without a token', async () => {
    const fakeId = new mongoose.Types.ObjectId();
    const res = await request(app).post(`/api/pets/${fakeId}/feed`).send({ itemCode: 'APPLE' });
    expect(res.status).toBe(401);
  });
});

describe('POST /api/pets/:id/evolve', () => {
  it('evolves an EGG to KID when ready at level 4', async () => {
    const { pet, token } = await createTestUser();
    await UserPet.findByIdAndUpdate(pet._id, {
      stage: 'EGG', level: 4, evolutionReady: true, isGrowthFrozen: true
    });

    const res = await request(app)
      .post(`/api/pets/${pet._id}/evolve`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.pet.stage).toBe('KID');
    expect(res.body.data.pet.level).toBe(5);
    expect(res.body.data.pet.growthPoints).toBe(0);
    expect(res.body.data.pet.evolutionReady).toBe(false);
  });

  it('evolves a KID to ADULT when ready at level 9', async () => {
    const { pet, token } = await createTestUser();
    await UserPet.findByIdAndUpdate(pet._id, {
      stage: 'KID', level: 9, evolutionReady: true, isGrowthFrozen: true
    });

    const res = await request(app)
      .post(`/api/pets/${pet._id}/evolve`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.pet.stage).toBe('ADULT');
    expect(res.body.data.pet.level).toBe(10);
  });

  it('returns 400 when an ADULT pet tries to evolve', async () => {
    const { pet, token } = await createTestUser();
    await UserPet.findByIdAndUpdate(pet._id, {
      stage: 'ADULT', level: 10, evolutionReady: true
    });

    const res = await request(app)
      .post(`/api/pets/${pet._id}/evolve`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
  });

  it('returns 400 when the pet is not evolutionReady', async () => {
    const { pet, token } = await createTestUser();
    const res = await request(app)
      .post(`/api/pets/${pet._id}/evolve`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
  });

  it('returns 404 when the pet does not exist', async () => {
    const { token } = await createTestUser();
    const fakeId = new mongoose.Types.ObjectId();
    const res = await request(app)
      .post(`/api/pets/${fakeId}/evolve`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  it('returns 401 without a token', async () => {
    const fakeId = new mongoose.Types.ObjectId();
    const res = await request(app).post(`/api/pets/${fakeId}/evolve`);
    expect(res.status).toBe(401);
  });
});

describe('PATCH /api/pets/:id/activate', () => {
  it('activates an INVENTORY pet and moves the previous active pet to INVENTORY', async () => {
    const { user, pet: activePet, species, token } = await createTestUser();
    const inventoryPet = await UserPet.create({
      userId: user._id, speciesId: species._id, stage: 'EGG', status: 'INVENTORY'
    });

    const res = await request(app)
      .patch(`/api/pets/${inventoryPet._id}/activate`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.activePet.stage).toBe('EGG');

    const prev = await UserPet.findById(activePet._id);
    expect(prev.status).toBe('INVENTORY');
  });

  it('returns 400 with an invalid (non-ObjectId) pet id', async () => {
    const { token } = await createTestUser();
    const res = await request(app)
      .patch('/api/pets/not-a-valid-id/activate')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
  });

  it('returns 404 when the pet does not exist', async () => {
    const { token } = await createTestUser();
    const fakeId = new mongoose.Types.ObjectId();
    const res = await request(app)
      .patch(`/api/pets/${fakeId}/activate`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  it('returns 401 without a token', async () => {
    const fakeId = new mongoose.Types.ObjectId();
    const res = await request(app).patch(`/api/pets/${fakeId}/activate`);
    expect(res.status).toBe(401);
  });
});
