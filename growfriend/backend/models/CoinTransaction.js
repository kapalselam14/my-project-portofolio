const mongoose = require('mongoose');

const CoinTransactionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    amount: { type: Number, required: true },
    balanceAfter: { type: Number, required: true, min: 0 },
    type: {
      type: String,
      enum: [
        'INITIAL_GRANT',
        'FOCUS_REWARD',
        'STORE_PURCHASE',
        'TASK_REWARD',
        'ESCROW_HOLD',
        'ESCROW_RELEASE',
        'ESCROW_PAYOUT',
        'ESCROW_REFUND',
        'ADMIN_ADJUSTMENT'
      ],
      required: true
    },
    relatedModel: { type: String, default: null },
    relatedId: { type: mongoose.Schema.Types.ObjectId, default: null },
    note: { type: String, default: null }
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// primary ledger history index
CoinTransactionSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('CoinTransaction', CoinTransactionSchema);