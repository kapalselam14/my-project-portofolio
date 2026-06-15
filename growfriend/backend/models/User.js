const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },

    // canonical auth fields
    passwordHash: { type: String, required: true, select: false },
    securityQuestionCode: { type: String, required: true, trim: true },
    securityAnswerHash: { type: String, required: true, select: false },

    coins: { type: Number, default: 30, min: 0 },
    roles: { type: [String], default: ['USER'] },
    activePetId: { type: mongoose.Schema.Types.ObjectId, ref: 'UserPet', default: null },
    avatar: { type: String, default: '' }
  },
  { timestamps: true }
);

// auto-hash password + security answer before save
UserSchema.pre('save', async function preSave(next) {
  try {
    if (this.isModified('passwordHash') && !this.passwordHash.startsWith('$2')) {
      this.passwordHash = await bcrypt.hash(this.passwordHash, 10);
    }

    if (this.isModified('securityAnswerHash') && !this.securityAnswerHash.startsWith('$2')) {
      this.securityAnswerHash = await bcrypt.hash(this.securityAnswerHash.trim().toLowerCase(), 10);
    }

    next();
  } catch (err) {
    next(err);
  }
});

// helper used by /login
UserSchema.methods.comparePassword = function comparePassword(plainPassword) {
  return bcrypt.compare(plainPassword, this.passwordHash);
};

module.exports = mongoose.model('User', UserSchema);