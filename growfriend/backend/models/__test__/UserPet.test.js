const mongoose = require('mongoose');
const UserPet = require('../UserPet');

const userId = new mongoose.Types.ObjectId();
const speciesId = new mongoose.Types.ObjectId();

const VALID = { userId, speciesId };

describe('UserPet model', () => {
  it('creates a valid pet with correct defaults', async () => {
    const pet = await UserPet.create(VALID);
    expect(pet.stage).toBe('EGG');
    expect(pet.level).toBe(1);
    expect(pet.growthPoints).toBe(0);
    expect(pet.evolutionReady).toBe(false);
    expect(pet.isGrowthFrozen).toBe(false);
    expect(pet.status).toBe('INVENTORY');
    expect(pet.nickname).toBe('');
  });

  it.each(['userId', 'speciesId'])('rejects missing required field: %s', async (field) => {
    const { [field]: _omit, ...data } = VALID;
    await expect(new UserPet(data).validate()).rejects.toThrow();
  });

  it('rejects level below 1', async () => {
    await expect(new UserPet({ ...VALID, level: 0 }).validate()).rejects.toThrow();
  });

  it('rejects level above 10', async () => {
    await expect(new UserPet({ ...VALID, level: 11 }).validate()).rejects.toThrow();
  });

  it('rejects growthPoints below 0', async () => {
    await expect(new UserPet({ ...VALID, growthPoints: -1 }).validate()).rejects.toThrow();
  });

  it('rejects growthPoints above 99', async () => {
    await expect(new UserPet({ ...VALID, growthPoints: 100 }).validate()).rejects.toThrow();
  });

  it('rejects an invalid stage enum', async () => {
    await expect(new UserPet({ ...VALID, stage: 'BABY' }).validate()).rejects.toThrow();
  });

  it('rejects an invalid status enum', async () => {
    await expect(new UserPet({ ...VALID, status: 'SOLD' }).validate()).rejects.toThrow();
  });

  it('accepts all valid stages', async () => {
    for (const stage of ['EGG', 'KID', 'ADULT']) {
      await expect(new UserPet({ ...VALID, stage }).validate()).resolves.toBeUndefined();
    }
  });
});
