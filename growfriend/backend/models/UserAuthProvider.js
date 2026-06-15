const mongoose = require('mongoose');

const UserAuthProviderSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    provider: { type: String, required: true },
    providerUserId: { type: String, required: true },
    email: { type: String, default: null }
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// blocks duplicate OAuth links
UserAuthProviderSchema.index({ provider: 1, providerUserId: 1 }, { unique: true });
UserAuthProviderSchema.index({ userId: 1, provider: 1 }, { unique: true });

module.exports = mongoose.model('UserAuthProvider', UserAuthProviderSchema);