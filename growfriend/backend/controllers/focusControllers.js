const mongoose = require('mongoose');
const FocusSession = require('../models/FocusSession');
const CoinTransaction = require('../models/CoinTransaction');
const User = require('../models/User');
const { sendSuccess, sendError } = require('../utils/apiResponse');
const { invalidateCoinMutationCaches } = require('../utils/cache');

const FOCUS_REWARD_COINS = 10;

// Start a focus session
exports.startFocusSession = async (req, res) => {
  try {
    const userId = req.userId;
    const { plannedDurationSec } = req.body || {};

    const existing = await FocusSession.findOne({
      userId,
      status: 'RUNNING'
    }).lean();

    if (existing) {
      return sendError(res, 'Active focus session already exists', 409, { activeSession: existing });
    }

    const session = await FocusSession.create({
      userId,
      plannedDurationSec: plannedDurationSec || 25 * 60,
      status: 'RUNNING',
      startedAt: new Date()
    });

    return sendSuccess(res, session, 'Focus session started');
  } catch (err) {
    return sendError(res, 'Failed to start focus session', 500, { detail: err.message });
  }
};

// Complete a focus session
exports.completeFocusSession = async (req, res) => {
  const dbSession = await mongoose.startSession();
  try {
    const userId = req.userId;
    const { id } = req.params;

    dbSession.startTransaction();

    const focusSession = await FocusSession.findOne({ _id: id, userId }).session(dbSession);
    if (!focusSession) {
      await dbSession.abortTransaction();
      dbSession.endSession();
      return sendError(res, 'Session not found', 404);
    }

    if (focusSession.status === 'CANCELLED') {
      await dbSession.abortTransaction();
      dbSession.endSession();
      return sendError(res, 'Session already cancelled', 400);
    }

    if (focusSession.status === 'COMPLETED' && focusSession.rewardedAt) {
      await dbSession.commitTransaction();
      dbSession.endSession();
      return sendSuccess(res, { session: focusSession }, 'Focus session already completed');
    }

    const endedAt = new Date();
    const actualDurationSec = Math.max(
      0,
      Math.round((endedAt.getTime() - new Date(focusSession.startedAt).getTime()) / 1000)
    );

    focusSession.status = 'COMPLETED';
    focusSession.endedAt = endedAt;
    focusSession.actualDurationSec = actualDurationSec;
    focusSession.rewardCoins = FOCUS_REWARD_COINS;
    focusSession.rewardedAt = endedAt;
    await focusSession.save({ session: dbSession });

    const user = await User.findById(userId).session(dbSession);
    if (!user) {
      throw new Error('User not found');
    }

    user.coins += FOCUS_REWARD_COINS;
    await user.save({ session: dbSession });

    await CoinTransaction.create([
      {
        userId,
        amount: FOCUS_REWARD_COINS,
        balanceAfter: user.coins,
        type: 'FOCUS_REWARD',
        relatedModel: 'FocusSession',
        relatedId: focusSession._id,
        note: `Focus reward for ${Math.round(actualDurationSec / 60)} min session`
      }
    ], { session: dbSession });


    await dbSession.commitTransaction();
    dbSession.endSession();
    await invalidateCoinMutationCaches(userId);

    return sendSuccess(res, { session: focusSession, coins: user.coins }, 'Focus session completed');
  } catch (err) {
    await dbSession.abortTransaction();
    dbSession.endSession();
    return sendError(res, 'Failed to complete focus session', 500, { detail: err.message });
  }
};

// Cancel a focus session
exports.cancelFocusSession = async (req, res) => {
  try {
    const userId = req.userId;
    const { id } = req.params;

    const session = await FocusSession.findOne({ _id: id, userId });
    if (!session) return sendError(res, 'Session not found', 404);

    session.status = 'CANCELLED';
    session.endedAt = new Date();
    await session.save();

    return sendSuccess(res, session, 'Focus session cancelled');
  } catch (err) {
    return sendError(res, 'Failed to cancel focus session', 500, { detail: err.message });
  }
};

// Get active focus session (if any)
exports.getActiveFocusSession = async (req, res) => {
  try {
    const userId = req.userId;

    const session = await FocusSession.findOne({
      userId,
      status: 'RUNNING'
    }).lean();

    if (!session) {
      return sendSuccess(res, null, 'No active focus session');
    }

    return sendSuccess(res, session, 'Active focus session found');
  } catch (err) {
    return sendError(res, 'Failed to fetch active focus session', 500, { detail: err.message });
  }
};
