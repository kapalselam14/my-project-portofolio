const mongoose = require('mongoose');

const TaskSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ['SYSTEM', 'PERSONAL', 'P2P'], required: true },
    visibility: { type: String, enum: ['PUBLIC', 'PRIVATE'], required: true, default: 'PUBLIC' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    objectives: { type: [String], default: [] },
    timeLimit: { type: Number, default: null },
    // Category applies to SYSTEM (community) tasks: 'organization' | 'activity'
    category: { type: String, enum: ['organization', 'activity'], default: null },
    rewardCoins: { type: Number, default: 0, min: 0 },
    status: {
      type: String,
      enum: ['OPEN', 'IN_PROGRESS', 'PENDING_CONFIRMATION', 'COMPLETED', 'CANCELLED', 'DISPUTED', 'CLOSED'],
      default: 'OPEN'
    },
    location: { type: String, default: null },
    startAt: { type: Date, default: null },
    endAt: { type: Date, default: null },
    requiresApplication: { type: Boolean, default: false },
    disputeRaisedBy: { type: String, enum: ['creator', 'assignee'], default: null },
    disputeReason: { type: String, default: null },
    disputeDetails: { type: String, default: null },
  },
  { timestamps: true }
);

// baseline list query index
TaskSchema.index({ type: 1, status: 1, createdAt: -1 });

module.exports = mongoose.model('Task', TaskSchema);