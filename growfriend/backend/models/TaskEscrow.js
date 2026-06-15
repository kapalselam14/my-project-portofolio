const mongoose = require('mongoose');

const TaskEscrowSchema = new mongoose.Schema(
  {
    taskId: { type: mongoose.Schema.Types.ObjectId, ref: 'Task', required: true, unique: true },
    payerUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    payeeUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    amount: { type: Number, required: true, min: 0 },
    status: { type: String, enum: ['HELD', 'RELEASED', 'PAID_OUT', 'REFUNDED'], default: 'HELD' },
    heldAt: { type: Date, default: Date.now },
    releasedAt: { type: Date, default: null },
    paidOutAt: { type: Date, default: null },
    refundedAt: { type: Date, default: null }
  },
  { timestamps: true }
);

// one escrow record per P2P task
// TaskEscrowSchema.index({ taskId: 1 }, { unique: true });

module.exports = mongoose.model('TaskEscrow', TaskEscrowSchema);