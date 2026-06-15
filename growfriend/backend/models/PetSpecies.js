const mongoose = require('mongoose');

const PetSpeciesSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true
    },

    displayName: {
      type: String,
      required: true
    },

    // Frontend sprite family key, e.g. apteryx / penguin / lemuera / pyro / pukeko / pateke
    // Not required, because disabled future species may not have frontend assets yet.
    spriteKey: {
      type: String,
      default: null,
      trim: true
    },

    // Controls whether this species can be used for new assignment.
    // Existing users can still display old pets even if enabled is false.
    enabled: {
      type: Boolean,
      default: false
    },

    // Can be randomly assigned during registration.
    starterEligible: {
      type: Boolean,
      default: false
    },

    // Can be selected by RANDOM_EGG.
    eggEligible: {
      type: Boolean,
      default: false
    },

    stages: [
      {
        stage: {
          type: String,
          enum: ['EGG', 'KID', 'ADULT'],
          required: true
        },
        displayName: {
          type: String,
          required: true
        },
        assetKey: {
          type: String,
          required: true
        }
      }
    ],

    rarity: {
      type: String,
      default: 'COMMON'
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('PetSpecies', PetSpeciesSchema);