const mongoose = require('mongoose');

const StoreItemSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    name: { type: String, required: true },
    type: { type: String, enum: ['FOOD', 'EGG'], required: true },
    price: { type: Number, required: true, min: 0 },
    growthValue: { type: Number, default: null }, // Only for FOOD items
    meta: { type: mongoose.Schema.Types.Mixed, default: null }
  },
  { timestamps: true }
);

// quick lookup by item code
// StoreItemSchema.index({ code: 1 }, { unique: true });

module.exports = mongoose.model('StoreItem', StoreItemSchema);