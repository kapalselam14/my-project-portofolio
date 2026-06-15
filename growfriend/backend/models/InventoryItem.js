const mongoose = require('mongoose');

const InventoryItemSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    storeItemId: { type: mongoose.Schema.Types.ObjectId, ref: 'StoreItem', required: true },
    quantity: { type: Number, required: true, min: 0, default: 0 }
  },
  { timestamps: true }
);

// one row per (user,item), no duplicates
InventoryItemSchema.index({ userId: 1, storeItemId: 1 }, { unique: true });

module.exports = mongoose.model('InventoryItem', InventoryItemSchema);