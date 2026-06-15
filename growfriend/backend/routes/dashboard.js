const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { sendSuccess, sendError } = require('../utils/apiResponse');

const User = require('../models/User');
const UserPet = require('../models/UserPet');
const StoreItem = require('../models/StoreItem');
const {
  buildUserCacheKey,
  getCachedJson,
  setCachedJson
} = require('../utils/cache');

const router = express.Router();

/**
 * Unlock rule is configurable to avoid hard-coded business logic drift.
 * EGG_UNLOCK_RULE:
 * - PET_ADULT (default)
 * - COINS_ONLY
 * - PET_ADULT_AND_COINS
 */
function computeEggUnlocked({ activePet, canAfford, unlockRule }) {
  const petAdult = Boolean(activePet) && activePet.stage === 'ADULT';

  switch (unlockRule) {
    case 'COINS_ONLY':
      return canAfford;
    case 'PET_ADULT_AND_COINS':
      return petAdult && canAfford;
    case 'PET_ADULT':
    default:
      return petAdult;
  }
}

router.get('/', requireAuth, async (req, res) => {
  try {
    const cacheKey = buildUserCacheKey(req.userId, 'dashboard', 'v1');
    const cached = await getCachedJson(cacheKey);
    if (cached) {
      return sendSuccess(res, cached, 'Dashboard loaded');
    }

    const user = await User.findById(req.userId).lean();
    if (!user) return sendError(res, 'User not found', 404);

    // Prefer explicit activePetId; fallback to ACTIVE status row.
    let activePet = null;

    if (user.activePetId) {
      activePet = await UserPet.findOne({ _id: user.activePetId, userId: user._id })
        .populate('speciesId', 'code displayName')
        .lean();
    }

    if (!activePet) {
      activePet = await UserPet.findOne({ userId: user._id, status: 'ACTIVE' })
        .populate('speciesId', 'code displayName')
        .lean();
    }

    const randomEggItem = await StoreItem.findOne({ code: 'RANDOM_EGG' }).lean();
    const eggPrice = randomEggItem?.price ?? null;
    const canAfford = typeof eggPrice === 'number' ? user.coins >= eggPrice : false;

    const unlockRule = process.env.EGG_UNLOCK_RULE || 'PET_ADULT';
    const eggUnlocked = computeEggUnlocked({ activePet, canAfford, unlockRule });

    const payload = {
      userSummary: {
        id: user._id,
        name: user.name,
        email: user.email,
        coins: user.coins,
        roles: user.roles
      },
      activePetSummary: activePet
        ? {
            id: activePet._id,
            speciesId: activePet.speciesId?._id || activePet.speciesId,
            speciesCode: activePet.speciesId?.code || null,
            speciesName: activePet.speciesId?.displayName || null,
            nickname: activePet.nickname,
            stage: activePet.stage,
            level: activePet.level,
            growthPoints: activePet.growthPoints,
            evolutionReady: activePet.evolutionReady,
            status: activePet.status
          }
        : null,
      storeFlags: {
        randomEgg: {
          listed: Boolean(randomEggItem),
          price: eggPrice,
          canAfford,
          unlockRule,
          eggUnlocked
        }
      }
    };

    await setCachedJson(cacheKey, payload, 30);
    return sendSuccess(res, payload, 'Dashboard loaded');
  } catch (err) {
    return sendError(res, 'Failed to load dashboard', 500, { detail: err.message });
  }
});

module.exports = router;
