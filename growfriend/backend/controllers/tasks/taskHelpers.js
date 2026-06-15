const mongoose = require('mongoose');
const Task = require('../../models/Task');
const TaskApplication = require('../../models/TaskApplication');
const TaskAssignment = require('../../models/TaskAssignment');
const TaskEscrow = require('../../models/TaskEscrow');
const CoinTransaction = require('../../models/CoinTransaction');
const User = require('../../models/User');
const { invalidateCoinMutationCachesForUsers } = require('../../utils/cache');

function formatTask(t) {
  let createdByFormatted;
  if (t.createdBy && typeof t.createdBy === 'object' && t.createdBy._id) {
    createdByFormatted = { id: String(t.createdBy._id), name: t.createdBy.name || '' };
  } else {
    createdByFormatted = { id: String(t.createdBy || ''), name: '' };
  }

  return {
    id: t._id,
    type: t.type,
    visibility: t.visibility,
    createdBy: createdByFormatted,
    title: t.title,
    description: t.description,
    objectives: t.objectives || [],
    timeLimit: t.timeLimit || null,
    category: t.category ?? null,
    rewardCoins: t.rewardCoins,
    status: t.status,
    location: t.location,
    startAt: t.startAt,
    endAt: t.endAt,
    requiresApplication: t.requiresApplication,
    disputeRaisedBy: t.disputeRaisedBy ?? null,
    disputeReason: t.disputeReason ?? null,
    disputeDetails: t.disputeDetails ?? null,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt
  };
}

function formatApplication(a) {
  return {
    id: a._id,
    taskId: a.taskId,
    userId: a.userId,
    status: a.status,
    appliedAt: a.appliedAt,
    decidedAt: a.decidedAt
  };
}

function formatAssignment(a) {
  return {
    id: a._id,
    taskId: a.taskId,
    assignedTo: a.assignedTo,
    assignedBy: a.assignedBy,
    status: a.status,
    checkInAt: a.checkInAt,
    checkOutAt: a.checkOutAt,
    completedAt: a.completedAt,
    creatorConfirmedAt: a.creatorConfirmedAt,
    rejectedAt: a.rejectedAt ?? null
  };
}

module.exports = {
  mongoose,
  Task,
  TaskApplication,
  TaskAssignment,
  TaskEscrow,
  CoinTransaction,
  User,
  invalidateCoinMutationCachesForUsers,
  formatTask,
  formatApplication,
  formatAssignment
};
