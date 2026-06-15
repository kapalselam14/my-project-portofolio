const mongoose = require('mongoose');

const StoreItem = require('../models/StoreItem');
const User = require('../models/User');
const InventoryItem = require('../models/InventoryItem');
const CoinTransaction = require('../models/CoinTransaction');
const UserPet = require('../models/UserPet');
const PetSpecies = require('../models/PetSpecies');
const {
  buildUserCacheKey,
  getCachedJson,
  setCachedJson,
  deleteCacheKeys
} = require('../utils/cache');

function userCacheKeys(userId) {
  return [
    buildUserCacheKey(userId, 'dashboard', 'v1'),
    buildUserCacheKey(userId, 'store-items', 'v1'),
    buildUserCacheKey(userId, 'inventory', 'v1'),
    buildUserCacheKey(userId, 'pet-active', 'v1'),
    buildUserCacheKey(userId, 'pet-collection', 'v1'),
    buildUserCacheKey(userId, 'coins-balance', 'v1')
  ];
}

async function getEggUnlockState(userId, session = null) {
  let query = UserPet.findOne({
    userId,
    stage: 'ADULT',
    level: { $gte: 10 },
    growthPoints: { $gte: 99 }
  }).select('_id stage level growthPoints status createdAt');

  if (session) query = query.session(session);

  const maxPet = await query;

  return {
    eggUnlocked: !!maxPet,
    eggLockedReason: maxPet ? null : 'NO_FULLY_MAXED_PET',
    firstPet: maxPet
  };
}

const getStoreItems = async (req, res) => {
  try {
    const userId = req.userId;
    const cacheKey = buildUserCacheKey(userId, 'store-items', 'v1');
    const cached = await getCachedJson(cacheKey);
    if (cached) {
      return res.status(200).json(cached);
    }

    const items = await StoreItem.find({})
      .select('code name type price growthValue meta createdAt updatedAt')
      .sort({ price: 1 })
      .lean();

  let eggUnlocked = false;
  let eggLockedReason = 'FIRST_PET_NOT_MAX';

  if (userId && mongoose.Types.ObjectId.isValid(userId)) {
    const unlockState = await getEggUnlockState(userId);

    eggUnlocked = unlockState.eggUnlocked;
    eggLockedReason = unlockState.eggLockedReason;
  }

    const itemsWithLock = items.map((item) => {
      if (item.code !== 'RANDOM_EGG') {
        return {
          ...item,
          locked: false,
          lockedReason: null
        };
      }

      return {
        ...item,
        locked: !eggUnlocked,
        lockedReason: eggUnlocked ? null : eggLockedReason
      };
    });

    const payload = {
      success: true,
      message: 'Store items loaded successfully',
      data: {
        items: itemsWithLock,
        eggUnlocked,
        eggLockedReason
      }
    };
    await setCachedJson(cacheKey, payload, 60);
    return res.status(200).json(payload);
  } catch (error) {
    console.error('getStoreItems error:', error);

    return res.status(500).json({
      success: false,
      error: {
        code: 'STORE_ITEMS_FETCH_FAILED',
        message: 'Failed to load store items',
        details: {}
      }
    });
  }
  console.log('[getStoreItems] req.userId:', req.userId);
};

const purchaseStoreItem = async (req, res) => {
  let session = null;

  try {
    const userId = req.userId;
    const { itemCode, quantity = 1 } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'USER_ID_REQUIRED',
          message: 'userId is required',
          details: {}
        }
      });
    }

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_USER_ID',
          message: 'userId is not a valid ObjectId',
          details: {}
        }
      });
    }

    if (!itemCode) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'ITEM_CODE_REQUIRED',
          message: 'itemCode is required',
          details: {}
        }
      });
    }

    if (!Number.isInteger(quantity) || quantity <= 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_QUANTITY',
          message: 'quantity must be a positive integer',
          details: {}
        }
      });
    }
    
    session = await mongoose.startSession();
    session.startTransaction();

    const user = await User.findById(userId).session(session);
    if (!user) {
      throw {
        status: 404,
        code: 'USER_NOT_FOUND',
        message: 'User not found'
      };
    }

    const item = await StoreItem.findOne({ code: itemCode.toUpperCase().trim() }).session(session);
    if (!item) {
      throw {
        status: 404,
        code: 'STORE_ITEM_NOT_FOUND',
        message: 'Store item not found'
      };
    }

    const totalCost = item.price * quantity;
    
    if (item.type !== 'FOOD' && item.code !== 'RANDOM_EGG') {
      throw {
        status: 400,
        code: 'UNSUPPORTED_STORE_ITEM_TYPE',
        message: 'This store item type is not supported yet'
      };
    }


    if (user.coins < totalCost) {
      throw {
        status: 400,
        code: 'INSUFFICIENT_COINS',
        message: 'Not enough coins to complete this purchase'
      };
    }

    // RANDOM_EGG purchase requires the first pet to reach max level,
    // no matter whether that pet is ACTIVE or in INVENTORY.
    if (item.code === 'RANDOM_EGG') {
      const unlockState = await getEggUnlockState(user._id, session);

      if (!unlockState.firstPet) {
        throw {
          status: 400,
          code: 'FIRST_PET_NOT_FOUND',
          message: 'First pet is required before purchasing a random egg'
        };
      }

      if (!unlockState.eggUnlocked) {
        throw {
          status: 400,
          code: 'STORE_ITEM_LOCKED',
          message: 'Random Egg is locked until the first pet reaches max level'
        };
      }
    }

    // deduct coins
    user.coins -= totalCost;
    await user.save({ session });

    // create ledger record
    await CoinTransaction.create(
      [
        {
          userId: user._id,
          amount: -totalCost,
          balanceAfter: user.coins,
          type: 'STORE_PURCHASE',
          relatedModel: 'StoreItem',
          relatedId: item._id,
          note: `Purchased ${quantity} x ${item.code}`
        }
      ],
      { session }
    );

    // FOOD -> increment inventory
    if (item.type === 'FOOD') {
      const updatedInventory = await InventoryItem.findOneAndUpdate(
        {
          userId: user._id,
          storeItemId: item._id
        },
        {
          $inc: { quantity }
        },
        {
          new: true,
          upsert: true,
          setDefaultsOnInsert: true,
          session
        }
      ).populate('storeItemId', 'code name type price growthValue');

      await session.commitTransaction();
      session.endSession();
      await deleteCacheKeys(userCacheKeys(user._id));

      return res.status(200).json({
        success: true,
        message: 'Purchase completed successfully',
        data: {
          coins: user.coins,
          purchasedItem: {
            itemCode: item.code,
            quantity
          },
          inventoryItem: {
            id: updatedInventory._id,
            itemCode: updatedInventory.storeItemId?.code || null,
            itemName: updatedInventory.storeItemId?.name || null,
            type: updatedInventory.storeItemId?.type || null,
            price: updatedInventory.storeItemId?.price ?? null,
            growthValue: updatedInventory.storeItemId?.growthValue ?? null,
            quantity: updatedInventory.quantity
          }
        }
      });
    }

    // RANDOM_EGG -> create new user pet(s)
    const eggSpecies = await PetSpecies.find({
      enabled: true,
      eggEligible: true,
      spriteKey: { $nin: [null, ''] }
    }).session(session);

    if (!eggSpecies.length) {
      throw {
        status: 500,
        code: 'PET_SPECIES_NOT_AVAILABLE',
        message: 'No eligible pet species available for random egg purchase'
      };
    }

    const newPets = [];

    for (let i = 0; i < quantity; i++) {
      const randomSpecies = eggSpecies[Math.floor(Math.random() * eggSpecies.length)];

      const createdPets = await UserPet.create(
        [
          { 
            userId: user._id,
            speciesId: randomSpecies._id,
            nickname: randomSpecies.displayName,
            stage: 'EGG',
            level: 1,
            growthPoints: 0,
            evolutionReady: false,
            isGrowthFrozen: false,
            status: 'INVENTORY'
          }
        ],
        { session }
      );

      newPets.push({
        pet: createdPets[0],
        species: randomSpecies
      });
    }

    await session.commitTransaction();
    session.endSession();
    await deleteCacheKeys(userCacheKeys(user._id));

    return res.status(200).json({
      success: true,
      message: 'Random egg purchase completed successfully',
      data: {
        coins: user.coins,
        purchasedItem: {
          itemCode: item.code,
          quantity
        },
        newPets: newPets.map(({ pet, species }) => ({
          id: pet._id,
          speciesId: pet.speciesId,
          speciesCode: species.code,
          speciesName: species.displayName,
          spriteKey: species.spriteKey,
          nickname: pet.nickname,
          stage: pet.stage,
          level: pet.level,
          growthPoints: pet.growthPoints,
          evolutionReady: pet.evolutionReady,
          isGrowthFrozen: pet.isGrowthFrozen,
          status: pet.status
        }))
      }
    });
  } catch (error) {
      if (session) {
        if (session.inTransaction()) {
          await session.abortTransaction();
        }
        session.endSession();
      }

      console.error('purchaseStoreItem error:', error);

      return res.status(error.status || 500).json({
        success: false,
        error: {
          code: error.code || 'STORE_PURCHASE_FAILED',
          message: error.message || 'Failed to complete purchase',
          details: {}
        }
      });
    }
};

module.exports = {
  getStoreItems,
  purchaseStoreItem
};
