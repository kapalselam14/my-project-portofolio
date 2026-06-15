// this script seeds pet species + store catalog safely with upserts

require('dotenv').config(); // npm runs from /backend so this picks backend/.env
const mongoose = require('mongoose');
const connectDB = require('../config/db');

const PetSpecies = require('../models/PetSpecies');
const StoreItem = require('../models/StoreItem');

const speciesData = [
  {
    code: 'KIWI',
    displayName: 'Kiwi',
    spriteKey: 'apteryx',
    enabled: true,
    starterEligible: true,
    eggEligible: true,
    stages: [
      { stage: 'EGG', displayName: 'Egg', assetKey: 'apteryx_egg' },
      { stage: 'KID', displayName: 'Lil Brown Kiwi', assetKey: 'apteryx_1' },
      { stage: 'ADULT', displayName: 'Great Spotted Kiwi (White Feather)', assetKey: 'apteryx_2' }
    ],
    rarity: 'RARE'
  },
  {
    code: 'PENGUIN',
    displayName: 'Penguin',
    spriteKey: 'penguin',
    enabled: true,
    starterEligible: true,
    eggEligible: true,
    stages: [
      { stage: 'EGG', displayName: 'Egg', assetKey: 'penguin_egg' },
      { stage: 'KID', displayName: 'Blue Penguin Chick', assetKey: 'penguin_1' },
      { stage: 'ADULT', displayName: 'Adult Blue Penguin', assetKey: 'penguin_2' }
    ],
    rarity: 'COMMON'
  },
  {
    code: 'LEMUERA',
    displayName: 'Lemur',
    spriteKey: 'lemuera',
    enabled: true,
    starterEligible: false,
    eggEligible: true,
    stages: [
      { stage: 'EGG', displayName: 'Egg', assetKey: 'lemuera_egg' },
      { stage: 'KID', displayName: 'Ring-tailed Lemur', assetKey: 'lemuera_1' },
      { stage: 'ADULT', displayName: 'Red Ruffed Lemur', assetKey: 'lemuera_2' }
    ],
    rarity: 'RARE'
  },
  {
    code: 'PYRO',
    displayName: 'Pyro',
    spriteKey: 'pyro',
    enabled: true,
    starterEligible: false,
    eggEligible: true,
    stages: [
      { stage: 'EGG', displayName: 'Egg', assetKey: 'pyro_egg' },
      { stage: 'KID', displayName: 'Fry', assetKey: 'pyro_1' },
      { stage: 'ADULT', displayName: 'Flaming Seahorse', assetKey: 'pyro_2' }
    ],
    rarity: 'EPIC'
  },
  {
    code: 'PUKEKO',
    displayName: 'Pukeko',
    spriteKey: 'pukeko',
    enabled: true,
    starterEligible: false,
    eggEligible: true,
    stages: [
      { stage: 'EGG', displayName: 'Egg', assetKey: 'pukeko_egg' },
      { stage: 'KID', displayName: 'Pukeko Chick', assetKey: 'pukeko_1' },
      { stage: 'ADULT', displayName: 'Adult Takahe', assetKey: 'pukeko_2' }
    ],
    rarity: 'COMMON'
  },
  {
    code: 'PATEKE',
    displayName: 'Pateke',
    spriteKey: 'pateke',
    enabled: true,
    starterEligible: true,
    eggEligible: true,
    stages: [
      { stage: 'EGG', displayName: 'Egg', assetKey: 'pateke_egg' },
      { stage: 'KID', displayName: 'Pateke Duckling', assetKey: 'pateke_1' },
      { stage: 'ADULT', displayName: 'Adult Pateke', assetKey: 'pateke_2' }
    ],
    rarity: 'COMMON'
  }
];

const storeItemsData = [
  { code: 'SNACK', name: 'Snack', type: 'FOOD', price: 8, growthValue: 5, meta: null },
  { code: 'MEAL', name: 'Meal', type: 'FOOD', price: 15, growthValue: 12, meta: null },
  { code: 'FEAST', name: 'Feast', type: 'FOOD', price: 21, growthValue: 19, meta: null },
  { code: 'RANDOM_EGG', name: 'Random Egg', type: 'EGG', price: 200, growthValue: null, meta: null }
];

const seedDB = async () => {
  try {
    await connectDB();
    console.log('Connected. Starting seed...');
    // Wipe old data - if Required
    //await PetSpecies.deleteMany({});
    for (const species of speciesData) {
      const result = await PetSpecies.updateOne(
        { code: species.code },
        { $set: species },
        { upsert: true }
      );

      console.log(
        `[PetSpecies] ${species.code}: matched=${result.matchedCount}, modified=${result.modifiedCount}, upserted=${result.upsertedCount}`
      );
    }


    for (const item of storeItemsData) {
      await StoreItem.updateOne(
        { code: item.code },
        { $set: item },
        { upsert: true }
      );
    }

    console.log('Seed complete. All good.');
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('Seed failed:', err.message);
    await mongoose.disconnect();
    process.exit(1);
  }
};

seedDB();