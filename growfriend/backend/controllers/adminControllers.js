const mongoose = require('mongoose');
const User = require('../models/User');
const CoinTransaction = require('../models/CoinTransaction');
const { invalidateCoinMutationCaches } = require('../utils/cache');

const listUsers = async (req, res) => {
  try {
    const users = await User.find({}).select('-passwordHash -securityAnswerHash').lean();

    return res.status(200).json({
      success: true,
      message: 'Users loaded',
      data: {
        users: users.map((u) => ({
          id: u._id,
          name: u.name,
          email: u.email,
          coins: u.coins,
          roles: u.roles,
          activePetId: u.activePetId,
          createdAt: u.createdAt
        }))
      }
    });
  } catch (error) {
    console.error('listUsers error:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'USERS_FETCH_FAILED', message: 'Failed to load users', details: {} }
    });
  }
};

const updateUserRoles = async (req, res) => {
  try {
    const { id } = req.params;
    const { roles } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_USER_ID', message: 'User id is not a valid ObjectId', details: {} }
      });
    }

    const validRoles = ['USER', 'ADMIN'];
    if (!Array.isArray(roles) || roles.length === 0 || !roles.every((r) => validRoles.includes(r)) || !roles.includes('USER')) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_ROLES', message: 'roles must be an array containing at least USER (valid values: USER, ADMIN)', details: {} }
      });
    }

    const user = await User.findByIdAndUpdate(
      id,
      { $set: { roles } },
      { new: true, select: '-passwordHash -securityAnswerHash' }
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        error: { code: 'USER_NOT_FOUND', message: 'User not found', details: {} }
      });
    }

    return res.status(200).json({
      success: true,
      message: 'User roles updated',
      data: { id: user._id, roles: user.roles }
    });
  } catch (error) {
    console.error('updateUserRoles error:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'ROLES_UPDATE_FAILED', message: 'Failed to update user roles', details: {} }
    });
  }
};

// POST /api/admin/coins/adjust
// Body: { userId, amount, note }
const adjustCoins = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    const { userId, amount, note } = req.body;

    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_USER_ID', message: 'userId must be a valid ObjectId', details: {} }
      });
    }

    const parsed = Number(amount);
    if (!Number.isFinite(parsed) || parsed === 0 || !Number.isInteger(parsed)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_AMOUNT', message: 'amount must be a non-zero integer', details: {} }
      });
    }

    session.startTransaction();

    const user = await User.findById(userId).session(session);
    if (!user) {
      throw { status: 404, code: 'USER_NOT_FOUND', message: 'User not found' };
    }

    if (user.coins + parsed < 0) {
      throw { status: 400, code: 'INSUFFICIENT_COINS', message: 'Adjustment would result in negative balance' };
    }

    user.coins += parsed;
    await user.save({ session });

    await CoinTransaction.create([{
      userId: user._id,
      amount: parsed,
      balanceAfter: user.coins,
      type: 'ADMIN_ADJUSTMENT',
      note: note ? String(note).trim() : null
    }], { session });

    await session.commitTransaction();
    session.endSession();
    await invalidateCoinMutationCaches(user._id);

    return res.status(200).json({
      success: true,
      message: 'Coins adjusted',
      data: { userId: user._id, adjustment: parsed, balanceAfter: user.coins }
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error('adjustCoins error:', error);
    return res.status(error.status || 500).json({
      success: false,
      error: { code: error.code || 'ADJUST_COINS_FAILED', message: error.message || 'Failed to adjust coins', details: {} }
    });
  }
};

module.exports = { listUsers, updateUserRoles, adjustCoins };
