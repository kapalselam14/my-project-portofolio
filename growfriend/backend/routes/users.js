const express = require('express');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const User = require('../models/User');
const UserPet = require('../models/UserPet');
const Task = require('../models/Task');
const TaskAssignment = require('../models/TaskAssignment');
const { requireAuth } = require('../middleware/auth');
const { sendSuccess, sendError } = require('../utils/apiResponse');

const router = express.Router();

// GET /api/users/me
router.get('/me', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.userId).lean();
    if (!user) return sendError(res, 'User not found', 404);

    const activePet = await UserPet.findOne({ userId: user._id, status: 'ACTIVE' })
      .select('nickname')
      .lean();

    return sendSuccess(res, {
      id: user._id,
      name: user.name,
      email: user.email,
      coins: user.coins,
      roles: user.roles,
      activePetId: user.activePetId,
      avatar: user.avatar,
      petName: activePet?.nickname || '',
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    }, 'User profile loaded');
  } catch (err) {
    return sendError(res, 'Failed to load user profile', 500, { detail: err.message });
  }
});

// GET /api/users/me/task-stats
router.get('/me/task-stats', requireAuth, async (req, res) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.userId);

    const [createdCount, completedByType] = await Promise.all([
      Task.countDocuments({ createdBy: userId }),
      TaskAssignment.aggregate([
        { $match: { assignedTo: userId, status: 'COMPLETED' } },
        { $lookup: { from: 'tasks', localField: 'taskId', foreignField: '_id', as: 'task' } },
        { $unwind: '$task' },
        { $match: { 'task.type': { $in: ['SYSTEM', 'P2P'] } } },
        { $group: { _id: '$task.type', count: { $sum: 1 } } }
      ])
    ]);

    const stats = completedByType.reduce((acc, row) => {
      if (row._id === 'SYSTEM') acc.systemCompleted = row.count;
      if (row._id === 'P2P') acc.p2pCompleted = row.count;
      return acc;
    }, { systemCompleted: 0, p2pCompleted: 0 });

    return sendSuccess(res, {
      systemCompleted: stats.systemCompleted,
      p2pCompleted: stats.p2pCompleted,
      tasksCreated: createdCount
    }, 'Task stats loaded');
  } catch (err) {
    return sendError(res, 'Failed to load task stats', 500, { detail: err.message });
  }
});

// PATCH /api/users/me
router.patch('/me', requireAuth, async (req, res) => {
  try {
    const { name, username, petName, avatar } = req.body || {};
    const updates = {};
    const newName = typeof name === 'string' ? name.trim() : (typeof username === 'string' ? username.trim() : null);

    if (newName !== null) {
      if (!newName) return sendError(res, 'Name cannot be empty', 400);
      if (newName.length < 3) return sendError(res, 'Name must be at least 3 characters', 400);
      updates.name = newName;
    }

    if (typeof avatar === 'string') {
      updates.avatar = avatar;
    }

    let updatedPet = null;

    if (typeof petName === 'string') {
      const trimmedPetName = petName.trim();
      if (!trimmedPetName) return sendError(res, 'Pet name cannot be empty', 400);

      const activePet = await UserPet.findOne({ userId: req.userId, status: 'ACTIVE' });
      if (!activePet) return sendError(res, 'Active pet not found', 404);

      activePet.nickname = trimmedPetName;
      updatedPet = await activePet.save();
    }

    let updatedUser = null;
    if (Object.keys(updates).length > 0) {
      updatedUser = await User.findByIdAndUpdate(
        req.userId,
        { $set: updates },
        { new: true }
      ).lean();
    }

    return sendSuccess(res, {
      user: updatedUser
        ? {
            id: updatedUser._id,
            name: updatedUser.name,
            email: updatedUser.email,
            coins: updatedUser.coins,
            roles: updatedUser.roles,
            activePetId: updatedUser.activePetId,
            avatar: updatedUser.avatar
          }
        : null,
      activePet: updatedPet
        ? {
            id: updatedPet._id,
            nickname: updatedPet.nickname,
            stage: updatedPet.stage,
            level: updatedPet.level,
            status: updatedPet.status
          }
        : null
    }, 'Profile updated');
  } catch (err) {
    return sendError(res, 'Failed to update profile', 500, { detail: err.message });
  }
});

// PATCH /api/users/me/password
router.patch('/me/password', requireAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body || {};
    if (!currentPassword || !newPassword) {
      return sendError(res, 'currentPassword and newPassword are required', 400);
    }
    if (String(newPassword).length < 8) {
      return sendError(res, 'New password must be at least 8 characters', 400);
    }

    const user = await User.findById(req.userId).select('+passwordHash');
    if (!user) return sendError(res, 'User not found', 404);

    const isMatch = await bcrypt.compare(String(currentPassword), user.passwordHash);
    if (!isMatch) return sendError(res, 'Current password is incorrect', 401);

    user.passwordHash = String(newPassword);
    await user.save();

    return sendSuccess(res, {}, 'Password updated successfully');
  } catch (err) {
    return sendError(res, 'Failed to update password', 500, { detail: err.message });
  }
});

module.exports = router;