const mongoose = require('mongoose');

const UserPetSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    speciesId: { type: mongoose.Schema.Types.ObjectId, ref: 'PetSpecies', required: true },
    nickname: { type: String, default: '' },
    stage: { type: String, enum: ['EGG', 'KID', 'ADULT'], default: 'EGG' },
    level: { type: Number, default: 1, min: 1, max: 10 },
    growthPoints: { type: Number, default: 0, min: 0, max: 99 },
    evolutionReady: { type: Boolean, default: false },
    isGrowthFrozen: { type: Boolean, default: false },
    status: { type: String, enum: ['ACTIVE', 'INVENTORY'], default: 'INVENTORY' }
  },
  { timestamps: true }
);

// service layer still enforces exactly one ACTIVE pet
UserPetSchema.index({ userId: 1, status: 1 });

module.exports = mongoose.model('UserPet', UserPetSchema);