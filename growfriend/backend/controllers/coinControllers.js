const CoinTransaction = require('../models/CoinTransaction');
const User = require('../models/User');
const { sendSuccess, sendError } = require('../utils/apiResponse');
const {
  buildUserCacheKey,
  getCachedJson,
  setCachedJson
} = require('../utils/cache');

// GET /api/coins/history
// Query: limit (default 20, max 100), skip (default 0), type
const getCoinHistory = async (req, res) => {
  try {
    const userId = req.userId;
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const skip = Math.max(parseInt(req.query.skip) || 0, 0);
    const { type } = req.query;

    const VALID_TYPES = [
      'INITIAL_GRANT', 'FOCUS_REWARD', 'STORE_PURCHASE', 'TASK_REWARD',
      'ESCROW_HOLD', 'ESCROW_RELEASE', 'ESCROW_PAYOUT', 'ESCROW_REFUND', 'ADMIN_ADJUSTMENT'
    ];

    if (type && !VALID_TYPES.includes(type)) {
      return sendError(res, `Invalid type. Must be one of: ${VALID_TYPES.join(', ')}`, 400);
    }

    const filter = { userId };
    if (type) filter.type = type;

    const [transactions, total] = await Promise.all([
      CoinTransaction.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      CoinTransaction.countDocuments(filter)
    ]);

    return sendSuccess(res, {
      transactions: transactions.map((t) => ({
        id: t._id,
        amount: t.amount,
        balanceAfter: t.balanceAfter,
        type: t.type,
        relatedModel: t.relatedModel,
        relatedId: t.relatedId,
        note: t.note,
        createdAt: t.createdAt
      })),
      pagination: { total, skip, limit }
    }, 'Coin history loaded');
  } catch (err) {
    console.error('getCoinHistory error:', err);
    return sendError(res, 'Failed to load coin history', 500);
  }
};

// GET /api/coins/balance
const getCoinBalance = async (req, res) => {
  try {
    const userId = req.userId;
    const cacheKey = buildUserCacheKey(userId, 'coins-balance', 'v1');
    const cached = await getCachedJson(cacheKey);
    if (cached) return sendSuccess(res, cached, 'Balance loaded');

    const user = await User.findById(userId).select('coins').lean();
    if (!user) return sendError(res, 'User not found', 404);

    const payload = { coins: user.coins };
    await setCachedJson(cacheKey, payload, 15);
    return sendSuccess(res, payload, 'Balance loaded');
  } catch (err) {
    console.error('getCoinBalance error:', err);
    return sendError(res, 'Failed to load balance', 500);
  }
};

module.exports = { getCoinHistory, getCoinBalance };
