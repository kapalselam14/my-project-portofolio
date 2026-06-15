const mongoose = require('mongoose');

const FocusSessionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    status: { type: String, enum: ['RUNNING', 'COMPLETED', 'CANCELLED'], default: 'RUNNING' },
    startedAt: { type: Date, default: Date.now, required: true },
    endedAt: { type: Date, default: null },
    plannedDurationSec: { type: Number, default: 1500 },
    actualDurationSec: { type: Number, default: null },
    rewardCoins: { type: Number, default: 0 },
    rewardedAt: { type: Date, default: null }
  },
  { timestamps: true }
);

// preps focus history endpoint sorting
FocusSessionSchema.index({ userId: 1, startedAt: -1 });

module.exports = mongoose.model('FocusSession', FocusSessionSchema);