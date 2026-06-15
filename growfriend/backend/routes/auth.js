const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const User = require('../models/User');
const UserPet = require('../models/UserPet');
const PetSpecies = require('../models/PetSpecies');
const CoinTransaction = require('../models/CoinTransaction');

const { sendSuccess, sendError } = require('../utils/apiResponse');
const { signAccessToken } = require('../utils/jwt');

const router = express.Router();

function isAucklandUniEmail(email) {
  const normalized = String(email).toLowerCase();
  return normalized.endsWith('@auckland.ac.nz') || normalized.endsWith('@aucklanduni.ac.nz');
}

const SECURITY_QUESTION_LABELS = {
  MOTHER_NAME: "What's my mother's first name?",
  FAV_SPOT: 'Where is my favourite spot in campus?',
  PET_NAME: 'What is the name of my first pet?'
};

function normalizeAnswer(ans) {
  return String(ans || '').trim().toLowerCase();
}

// keep full handler in try/catch so async DB errors are always returned cleanly
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, securityQuestionCode, securityAnswer, avatar } = req.body || {};

    if (!name || !email || !password || !securityQuestionCode || !securityAnswer) {
      return sendError(res, 'Missing required fields', 400);
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    if (!isAucklandUniEmail(normalizedEmail)) {
      return sendError(res, 'Only Auckland University emails are allowed', 400);
    }

    if (String(password).length < 8) {
      return sendError(res, 'Password must be at least 8 characters', 400);
    }

    const existing = await User.findOne({ email: normalizedEmail }).lean();
    if (existing) {
      return sendError(res, 'Email already registered', 409);
    }

    const session = await mongoose.startSession();
    let createdUser;
    let createdPet;

    try {
      await session.withTransaction(async () => {
        const users = await User.create(
          [{
            name: String(name).trim(),
            email: normalizedEmail,
            passwordHash: String(password),
            securityQuestionCode: String(securityQuestionCode).trim(),
            securityAnswerHash: String(securityAnswer),
            avatar: avatar ? String(avatar) : '',
            coins: 30,
            roles: ['USER']
          }],
          { session }
        );
        createdUser = users[0];

        const starterSpecies = await PetSpecies.find({
          enabled: true,
          starterEligible: true,
          spriteKey: { $nin: [null, ''] }
        }).session(session);

        let defaultSpecies = null;

        if (starterSpecies.length > 0) {
          defaultSpecies = starterSpecies[Math.floor(Math.random() * starterSpecies.length)];
        } else {
          // fallback for safety
          defaultSpecies =
            await PetSpecies.findOne({ code: 'KIWI' }).session(session) ||
            await PetSpecies.findOne({}).sort({ createdAt: 1 }).session(session);
        }

        if (!defaultSpecies) {
          throw new Error('NO_PET_SPECIES');
        }


        const pets = await UserPet.create(
          [{
            userId: createdUser._id,
            speciesId: defaultSpecies._id,
            nickname: defaultSpecies.displayName,
            stage: 'EGG',
            level: 1,
            growthPoints: 0,
            evolutionReady: false,
            isGrowthFrozen: false,
            status: 'ACTIVE'
          }],
          { session }
        );
        createdPet = pets[0];

        createdUser.activePetId = createdPet._id;
        await createdUser.save({ session });

        await CoinTransaction.create(
          [{
            userId: createdUser._id,
            amount: 30,
            balanceAfter: 30,
            type: 'INITIAL_GRANT',
            note: 'Initial signup grant'
          }],
          { session }
        );
      });
    } finally {
      await session.endSession();
    }

    const token = signAccessToken(createdUser);

    return sendSuccess(
      res,
      {
        token,
        user: {
          id: createdUser._id,
          name: createdUser.name,
          email: createdUser.email,
          coins: createdUser.coins,
          roles: createdUser.roles,
          activePetId: createdUser.activePetId,
          avatar: createdUser.avatar
        },
        defaultPet: {
          id: createdPet._id,
          speciesId: createdPet.speciesId,
          stage: createdPet.stage,
          status: createdPet.status
        }
      },
      'Registered successfully',
      201
    );
  } catch (err) {
    if (err.code === 11000) return sendError(res, 'Email already registered', 409);
    if (err.message === 'NO_PET_SPECIES') return sendError(res, 'No pet species found. Run seed first.', 500);
    return sendError(res, 'Registration failed', 500, { detail: err.message });
  }
});

// same thing here, keep all async calls protected
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return sendError(res, 'Email and password are required', 400);
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    const user = await User.findOne({ email: normalizedEmail }).select('+passwordHash');
    if (!user) {
      return sendError(res, 'Invalid credentials', 401);
    }

    const isValidPassword = await user.comparePassword(String(password));
    if (!isValidPassword) {
      return sendError(res, 'Invalid credentials', 401);
    }

    const token = signAccessToken(user);

    return sendSuccess(
      res,
      {
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          coins: user.coins,
          roles: user.roles,
          activePetId: user.activePetId,
          avatar: user.avatar
        }
      },
      'Login successful'
    );
  } catch (err) {
    return sendError(res, 'Login failed', 500, { detail: err.message });
  }
});

/**
 * POST /api/auth/forgot/identify
 * Body: { identifier }
 * - identifier can be email or username (User.name)
 */
router.post('/forgot/identify', async (req, res) => {
  try {
    const { identifier } = req.body || {};
    if (!identifier) return sendError(res, 'Identifier is required', 400);

    const id = String(identifier).trim();
    let user = null;

    if (id.includes('@')) {
      const normalizedEmail = id.toLowerCase();
      user = await User.findOne({ email: normalizedEmail }).lean();
    } else {
      const matches = await User.find({ name: id }).lean();
      if (matches.length > 1) {
        return sendError(res, 'Multiple users found. Please use email instead.', 409);
      }
      user = matches[0] || null;
    }

    if (!user) return sendError(res, 'No such user found', 404);

    return sendSuccess(res, {
      userId: user._id,
      email: user.email,
      securityQuestionCode: user.securityQuestionCode,
      securityQuestionLabel: SECURITY_QUESTION_LABELS[user.securityQuestionCode] || null
    }, 'User found');
  } catch (err) {
    return sendError(res, 'Failed to identify user', 500, { detail: err.message });
  }
});

/**
 * POST /api/auth/forgot/reset
 * Body: { userId, email, securityAnswer, newPassword }
 */
router.post('/forgot/reset', async (req, res) => {
  try {
    const { userId, email, securityAnswer, newPassword } = req.body || {};

    if (!userId || !email || !securityAnswer || !newPassword) {
      return sendError(res, 'Missing required fields', 400);
    }

    if (String(newPassword).length < 8) {
      return sendError(res, 'Password must be at least 8 characters', 400);
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    const user = await User.findOne({ _id: userId, email: normalizedEmail })
      .select('+securityAnswerHash +passwordHash');

    if (!user) return sendError(res, 'User not found', 404);

    const isAnswerValid = await bcrypt.compare(normalizeAnswer(securityAnswer), user.securityAnswerHash);
    if (!isAnswerValid) return sendError(res, 'Security answer is incorrect', 401);

    user.passwordHash = String(newPassword);
    await user.save();

    return sendSuccess(res, {}, 'Password updated successfully');
  } catch (err) {
    return sendError(res, 'Failed to reset password', 500, { detail: err.message });
  }
});

module.exports = router;