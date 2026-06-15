const mongoose = require('mongoose');

const TaskApplicationSchema = new mongoose.Schema(
  {
    taskId: { type: mongoose.Schema.Types.ObjectId, ref: 'Task', required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    status: { type: String, enum: ['PENDING', 'ACCEPTED', 'REJECTED', 'WITHDRAWN'], default: 'PENDING' },
    appliedAt: { type: Date, default: Date.now },
    decidedAt: { type: Date, default: null }
  },
  { timestamps: true }
);

// one application per user per task
TaskApplicationSchema.index({ taskId: 1, userId: 1 }, { unique: true });
TaskApplicationSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('TaskApplication', TaskApplicationSchema);