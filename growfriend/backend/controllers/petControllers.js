const mongoose = require('mongoose');
const UserPet = require('../models/UserPet');
const PetSpecies = require('../models/PetSpecies');
const InventoryItem = require('../models/InventoryItem');
const StoreItem = require('../models/StoreItem');
const User = require('../models/User');
const {
  buildUserCacheKey,
  getCachedJson,
  setCachedJson,
  deleteCacheKeys
} = require('../utils/cache');

const PET_SPECIES_SELECT = 'code displayName spriteKey enabled';

function formatPetResponse(pet) {
  return {
    id: pet._id,
    speciesId: pet.speciesId?._id || pet.speciesId || null,
    speciesCode: pet.speciesId?.code || null,
    speciesName: pet.speciesId?.displayName || null,

    // key point: frontend should use this first
    spriteKey: pet.speciesId?.spriteKey || 'apteryx',

    nickname: pet.nickname,
    stage: pet.stage,
    level: pet.level,
    growthPoints: pet.growthPoints,
    evolutionReady: pet.evolutionReady,
    isGrowthFrozen: pet.isGrowthFrozen,
    status: pet.status
  };
}

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

const getActivePet = async (req, res) => {
  try {
    const userId = req.userId;
    const cacheKey = buildUserCacheKey(userId, 'pet-active', 'v1');
    const cached = await getCachedJson(cacheKey);
    if (cached) return res.status(200).json(cached);


    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_AUTH_USER',
          message: 'Authenticated user id is missing or invalid',
          details: {}
        }
      });
    }

    const activePet = await UserPet.findOne({
      userId,
      status: 'ACTIVE'
    }).populate('speciesId', PET_SPECIES_SELECT);

    if (!activePet) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'ACTIVE_PET_NOT_FOUND',
          message: 'No active pet found for this user',
          details: {}
        }
      });
    }

    const payload = {
      success: true,
      message: 'Active pet loaded successfully',
      data: {
        activePet: formatPetResponse(activePet)
      }
    };

    await setCachedJson(cacheKey, payload, 30);
    return res.status(200).json(payload);
  } catch (error) {
    console.error('getActivePet error:', error);

    return res.status(500).json({
      success: false,
      error: {
        code: 'ACTIVE_PET_FETCH_FAILED',
        message: 'Failed to load active pet',
        details: {}
      }
    });
  }
};

const getInactivePets = async (req, res) => {
  try {
    const userId = req.userId;
    const cacheKey = buildUserCacheKey(userId, 'pet-collection', 'v1');
    const cached = await getCachedJson(cacheKey);
    if (cached) return res.status(200).json(cached);

    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_AUTH_USER',
          message: 'Authenticated user id is missing or invalid',
          details: {}
        }
      });
    }

    const inactivePets = await UserPet.find({
      userId,
      status: { $ne: 'ACTIVE' }
    })
      .populate('speciesId', 'code displayName')
      .sort({ createdAt: -1 });

    const payload = {
      success: true,
      message: 'Inactive pets loaded successfully',
      data: {
        pets: inactivePets.map((pet) => ({
          id: pet._id,
          speciesCode: pet.speciesId?.code || null,
          speciesName: pet.speciesId?.displayName || null,
          nickname: pet.nickname,
          stage: pet.stage,
          level: pet.level,
          growthPoints: pet.growthPoints,
          evolutionReady: pet.evolutionReady,
          isGrowthFrozen: pet.isGrowthFrozen,
          status: pet.status
        }))
      }
    };

    await setCachedJson(cacheKey, payload, 30);
    return res.status(200).json(payload);
  } catch (error) {
    console.error('getInactivePets error:', error);

    return res.status(500).json({
      success: false,
      error: {
        code: 'INACTIVE_PETS_FETCH_FAILED',
        message: 'Failed to load inactive pets',
        details: {}
      }
    });
  }
};

const updateActivePetNickname = async (req, res) => {
  try {
    const userId = req.userId;
    const { nickname } = req.body || {};

    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_AUTH_USER',
          message: 'Authenticated user id is missing or invalid',
          details: {}
        }
      });
    }

    if (typeof nickname !== 'string') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'PET_NICKNAME_REQUIRED',
          message: 'nickname is required',
          details: {}
        }
      });
    }

    const trimmedNickname = nickname.trim();
    if (!trimmedNickname) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'PET_NICKNAME_EMPTY',
          message: 'Pet name cannot be empty',
          details: {}
        }
      });
    }

    if (trimmedNickname.length > 30) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'PET_NICKNAME_TOO_LONG',
          message: 'Pet name must be 30 characters or fewer',
          details: {}
        }
      });
    }

    const activePet = await UserPet.findOne({
      userId,
      status: 'ACTIVE'
    }).populate('speciesId', 'code displayName');

    if (!activePet) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'ACTIVE_PET_NOT_FOUND',
          message: 'No active pet found for this user',
          details: {}
        }
      });
    }

    activePet.nickname = trimmedNickname;
    await activePet.save();
    await deleteCacheKeys(userCacheKeys(userId));

    return res.status(200).json({
      success: true,
      message: 'Active pet name updated successfully',
      data: {
        activePet: {
          id: activePet._id,
          speciesCode: activePet.speciesId?.code || null,
          speciesName: activePet.speciesId?.displayName || null,
          nickname: activePet.nickname,
          stage: activePet.stage,
          level: activePet.level,
          growthPoints: activePet.growthPoints,
          evolutionReady: activePet.evolutionReady,
          isGrowthFrozen: activePet.isGrowthFrozen,
          status: activePet.status
        }
      }
    });
  } catch (error) {
    console.error('updateActivePetNickname error:', error);

    return res.status(500).json({
      success: false,
      error: {
        code: 'ACTIVE_PET_NAME_UPDATE_FAILED',
        message: 'Failed to update active pet name',
        details: {}
      }
    });
  }
};

const getStageCap = (stage) => {
  if (stage === 'EGG') return 4;
  if (stage === 'KID') return 9;
  if (stage === 'ADULT') return 10;
  return 10;
};

const applyGrowthToPet = (pet, growthValue) => {
  let growth = pet.growthPoints + growthValue;

  // Adult max state: allow bar to fill visually up to 99
  if (pet.stage === 'ADULT' && pet.level === 10) {
    pet.growthPoints = Math.min(99, growth);
    pet.evolutionReady = false;
    pet.isGrowthFrozen = false;
    return;
  }

  while (growth >= 100) {
    const stageCap = getStageCap(pet.stage);

    if (pet.level < stageCap) {
      pet.level += 1;
      growth -= 100;
    } else {
      pet.growthPoints = 99;
      pet.evolutionReady = true;
      pet.isGrowthFrozen = true;
      return;
    }
  }

  pet.growthPoints = growth;
};

const feedPet = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;
    const { itemCode } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_PET_ID',
          message: 'Pet id is not a valid ObjectId',
          details: {}
        }
      });
    }


    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_AUTH_USER',
          message: 'Authenticated user id is missing or invalid',
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

    const pet = await UserPet.findOne({
      _id: id,
      userId
    }).populate('speciesId', PET_SPECIES_SELECT);

    if (!pet) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'PET_NOT_FOUND',
          message: 'Pet not found for this user',
          details: {}
        }
      });
    }

    if (pet.isGrowthFrozen) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'PET_EVOLVE_REQUIRED',
          message: 'Pet must evolve before it can be fed again',
          details: {}
        }
      });
    }

    const storeItem = await StoreItem.findOne({
      code: itemCode.toUpperCase().trim()
    });

    if (!storeItem) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'STORE_ITEM_NOT_FOUND',
          message: 'Store item not found',
          details: {}
        }
      });
    }

    if (storeItem.type !== 'FOOD') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_FEED_ITEM',
          message: 'Only FOOD items can be used to feed pets',
          details: {}
        }
      });
    }

    const inventoryItem = await InventoryItem.findOne({
      userId,
      storeItemId: storeItem._id
    }).populate('storeItemId', 'code name type price growthValue');

    if (!inventoryItem) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'INVENTORY_ITEM_NOT_FOUND',
          message: 'This item is not in the user inventory',
          details: {}
        }
      });
    }

    if (inventoryItem.quantity < 1) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVENTORY_INSUFFICIENT_QUANTITY',
          message: 'Not enough item quantity to feed the pet',
          details: {}
        }
      });
    }

    inventoryItem.quantity -= 1;
    await inventoryItem.save();

    applyGrowthToPet(pet, storeItem.growthValue || 0);
    await pet.save();
    await deleteCacheKeys(userCacheKeys(userId));

    return res.status(200).json({
      success: true,
      message: 'Pet fed successfully',
      data: {
        pet: formatPetResponse(pet)
        ,
        inventoryItem: {
          id: inventoryItem._id,
          itemCode: inventoryItem.storeItemId?.code || null,
          itemName: inventoryItem.storeItemId?.name || null,
          type: inventoryItem.storeItemId?.type || null,
          price: inventoryItem.storeItemId?.price ?? null,
          growthValue: inventoryItem.storeItemId?.growthValue ?? null,
          quantity: inventoryItem.quantity
        }
      }
    });
  } catch (error) {
    console.error('feedPet error:', error);

    return res.status(500).json({
      success: false,
      error: {
        code: 'PET_FEED_FAILED',
        message: 'Failed to feed pet',
        details: {}
      }
    });
  }
};

const evolvePet = async (req, res) => {
  try {
    const { id } = req.params;
    const { speciesId } = req.body;
    const userId = req.userId;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_PET_ID',
          message: 'Pet id is not a valid ObjectId',
          details: {}
        }
      });
    }

    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_AUTH_USER',
          message: 'Authenticated user id is missing or invalid',
          details: {}
        }
      });
    }

    // Validate speciesId if provided
    if (speciesId && !mongoose.Types.ObjectId.isValid(speciesId)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_SPECIES_ID',
          message: 'Species id is not a valid ObjectId',
          details: {}
        }
      });
    }

    const pet = await UserPet.findOne({
      _id: id,
      userId
    }).populate('speciesId', PET_SPECIES_SELECT);

    if (!pet) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'PET_NOT_FOUND',
          message: 'Pet not found for this user',
          details: {}
        }
      });
    }

    if (pet.stage === 'ADULT') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'PET_ALREADY_MAX_STAGE',
          message: 'Adult pet cannot evolve further',
          details: {}
        }
      });
    }

    if (!pet.evolutionReady) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'PET_NOT_ELIGIBLE_TO_EVOLVE',
          message: 'Pet is not ready to evolve',
          details: {}
        }
      });
    }

    // For EGG -> KID: validate and set speciesId if provided
    if (pet.stage === 'EGG') {
      if (pet.level !== 4) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'PET_NOT_ELIGIBLE_TO_EVOLVE',
            message: 'Egg can only evolve at level 4',
            details: {}
          }
        });
      }

      if (speciesId) {
        // Verify the species exists
        const species = await PetSpecies.findById(speciesId);
        if (!species) {
          return res.status(400).json({
            success: false,
            error: {
              code: 'INVALID_SPECIES_ID',
              message: 'Specified species does not exist',
              details: {}
            }
          });
        }
        pet.speciesId = speciesId;
      }

      pet.stage = 'KID';
      pet.level = 5;
    } else if (pet.stage === 'KID') {
      if (pet.level !== 9) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'PET_NOT_ELIGIBLE_TO_EVOLVE',
            message: 'Kid can only evolve at level 9',
            details: {}
          }
        });
      }

      pet.stage = 'ADULT';
      pet.level = 10;
    }

    pet.growthPoints = 0;
    pet.evolutionReady = false;
    pet.isGrowthFrozen = false;

    await pet.save();
    await deleteCacheKeys(userCacheKeys(userId));

    return res.status(200).json({
      success: true,
      message: 'Pet evolved successfully',
      data: {
        pet: formatPetResponse(pet)
      }
    });
  } catch (error) {
    console.error('evolvePet error:', error);

    return res.status(500).json({
      success: false,
      error: {
        code: 'PET_EVOLVE_FAILED',
        message: 'Failed to evolve pet',
        details: {}
      }
    });
  }
};

const activatePet = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    const { id } = req.params;
    const userId = req.userId;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_PET_ID',
          message: 'Pet id is not a valid ObjectId',
          details: {}
        }
      });
    }


    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_AUTH_USER',
          message: 'Authenticated user id is missing or invalid',
          details: {}
        }
      });
    }

    session.startTransaction();

    const user = await User.findById(userId).session(session);
    if (!user) {
      throw {
        status: 404,
        code: 'USER_NOT_FOUND',
        message: 'User not found'
      };
    }

    const targetPet = await UserPet.findById(id).session(session);
    if (!targetPet) {
      throw {
        status: 404,
        code: 'PET_NOT_FOUND',
        message: 'Pet not found'
      };
    }

    if (String(targetPet.userId) !== String(userId)) {
      throw {
        status: 403,
        code: 'PET_NOT_OWNED',
        message: 'This pet does not belong to the user'
      };
    }

    await UserPet.updateMany(
      { userId: user._id, status: 'ACTIVE' },
      { $set: { status: 'INVENTORY' } },
      { session }
    );

    targetPet.status = 'ACTIVE';
    await targetPet.save({ session });

    user.activePetId = targetPet._id;
    await user.save({ session });

    const populatedActivePet = await UserPet.findById(targetPet._id)
      .populate('speciesId', 'code displayName')
      .session(session);

    await session.commitTransaction();
    session.endSession();
    await deleteCacheKeys(userCacheKeys(userId));

    return res.status(200).json({
      success: true,
      message: 'Active pet updated successfully',
      data: {
        activePetId: targetPet._id,
        activePet: {
          id: populatedActivePet?._id || targetPet._id,
          speciesCode: populatedActivePet?.speciesId?.code || null,
          speciesName: populatedActivePet?.speciesId?.displayName || null,
          nickname: populatedActivePet?.nickname || '',
          stage: populatedActivePet?.stage || null,
          level: populatedActivePet?.level ?? null,
          growthPoints: populatedActivePet?.growthPoints ?? null,
          evolutionReady: populatedActivePet?.evolutionReady ?? false,
          isGrowthFrozen: populatedActivePet?.isGrowthFrozen ?? false,
          status: populatedActivePet?.status || 'ACTIVE'
        }
      }
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();

    console.error('activatePet error:', error);

    return res.status(error.status || 500).json({
      success: false,
      error: {
        code: error.code || 'PET_ACTIVATE_FAILED',
        message: error.message || 'Failed to activate pet',
        details: {}
      }
    });
  }
};

module.exports = {
  getActivePet,
  getInactivePets,
  updateActivePetNickname,
  feedPet,
  evolvePet,
  activatePet
};
