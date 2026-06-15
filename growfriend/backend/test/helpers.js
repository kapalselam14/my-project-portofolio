const User = require('../models/User');
const PetSpecies = require('../models/PetSpecies');
const UserPet = require('../models/UserPet');
const StoreItem = require('../models/StoreItem');
const InventoryItem = require('../models/InventoryItem');
const { signAccessToken } = require('../utils/jwt');

const DEFAULT_PASSWORD = 'Password1234';

async function seedSpecies() {
  return PetSpecies.findOneAndUpdate(
    { code: 'KIWI' },
    {
      code: 'KIWI',
      displayName: 'Kiwi',
      spriteKey: 'apteryx',
      stages: [
        { stage: 'EGG', displayName: 'Kiwi Egg', assetKey: 'kiwi_egg' },
        { stage: 'KID', displayName: 'Kiwi Kid', assetKey: 'kiwi_kid' },
        { stage: 'ADULT', displayName: 'Kiwi Adult', assetKey: 'kiwi_adult' }
      ],
      rarity: 'RARE'
    },
    { upsert: true, new: true }
  );
}

// Creates a user + active pet directly in DB (no HTTP, no transaction).
// Returns { user, pet, species, token } for use in route/unit tests.
async function createTestUser(overrides = {}) {
  const species = await seedSpecies();

  const user = await User.create({
    name: 'Test User',
    email: 'test@aucklanduni.ac.nz',
    passwordHash: DEFAULT_PASSWORD,
    securityQuestionCode: 'MOTHER_NAME',
    securityAnswerHash: 'mum',
    coins: 30,
    roles: ['USER'],
    ...overrides
  });

  const pet = await UserPet.create({
    userId: user._id,
    speciesId: species._id,
    stage: 'EGG',
    level: 1,
    status: 'ACTIVE'
  });

  // Update activePetId without triggering unnecessary pre-save hashing
  await User.findByIdAndUpdate(user._id, { activePetId: pet._id });
  user.activePetId = pet._id;

  const token = signAccessToken(user);
  return { user, pet, species, token };
}

async function seedStoreItem(overrides = {}) {
  const data = {
    code: 'APPLE',
    name: 'Apple',
    type: 'FOOD',
    price: 5,
    growthValue: 20,
    ...overrides
  };
  return StoreItem.findOneAndUpdate(
    { code: (data.code || 'APPLE').toUpperCase() },
    data,
    { upsert: true, new: true }
  );
}

async function seedInventoryItem(userId, storeItemId, quantity = 3) {
  return InventoryItem.findOneAndUpdate(
    { userId, storeItemId },
    { userId, storeItemId, quantity },
    { upsert: true, new: true }
  );
}

module.exports = { DEFAULT_PASSWORD, seedSpecies, createTestUser, seedStoreItem, seedInventoryItem };
