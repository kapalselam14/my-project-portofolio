import express from 'express';
import * as yup from 'yup';
import { loginUser, createUser, getUserById, getUserSecurityQuestion, verifySecurityAnswer, resetUserPassword } from '../../data/user-dao.js';
import { getDatabase } from '../../data/database.js';
import { blacklistToken } from '../../data/token-blacklist.js';
import { createUserJWT } from '../../utils/jwt-utils.js';
import { requireAuth } from '../../middleware/auth-middleware.js';
import dayjs from 'dayjs';
import jwt from 'jsonwebtoken';
import { uploadAvatar, avatarProcess } from '../../middleware/upload-middleware.js';

const router = express.Router();

//=====VALIDATION SCHEMAS=====

const loginSchema = yup.object({
    username: yup.string()
        .min(3)
        .max(20)
        .required(),
    password: yup.string()
        .required(),
}).required();

const registerSchema = yup.object({
    username: yup.string()
    .min(3)
    .max(32)
    .matches(/^[a-z0-9_.]+$/, 'Username can only contain lowercase letters, numbers, underscores, and dots')
    .required(),
    password: yup.string()
        .matches(/[A-Z]/, 'Password must contain UPPERCASE')
        .matches(/[a-z]/, 'Password must contain lowercase')
        .matches(/[0-9]/, 'Password must contain number')
        .matches(/[^a-zA-Z0-9]/, 'Password must contain symbol')
        .min(8)
        .required(),
    confirmPassword: yup.string()
        .oneOf([yup.ref('password')], 'Password must match!')
        .required(),
    real_name: yup.string()
        .min(2)
        .max(64)
        .required(),
        date_of_birth: yup.string()
        .matches(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')
        .test('is-valid-date', 'Invalid date', function(value) {
            if (!value) return false;
            const date = new Date(value);
            return date instanceof Date && !isNaN(date);
        })
        .test('not-future', 'Date of birth cannot be in the future', function(value) {
            if (!value) return false;
            const date = new Date(value);
            const today = new Date();
            today.setHours(0, 0, 0, 0); // Set to start of day for fair comparison
            return date <= today;
        })
        .test('min-age', 'You must be at least 13 years old', function(value) {
            if (!value) return false;
            const date = new Date(value);
            const minDate = dayjs().subtract(13, 'years').toDate();
            return date <= minDate;
        })
        .test('max-age', 'Invalid date of birth', function(value) {
            if (!value) return false;
            const date = new Date(value);
            const maxDate = dayjs().subtract(120, 'years').toDate();
            return date >= maxDate;
        })
        .required('Date of birth is required!'),
    description: yup.string()
        .max(500)
        .optional(),
    avatar_url: yup.string()
        .max(255)
        .optional(),
    security_question_id: yup.number().required(),
    security_answer: yup.string().min(2).max(255).required()
}).required();

//=====LOGIN ROUTE (POST /api/auth/login)=====
// 1: Validate request body (username, password)
// 2: Call loginUser(username, password) from DAO
// 3: Create JWT token using createUserJWT(username, '7d')
// 4: Return 200 with token and user data
// Error handling: 400 (validation), 401 (invalid credentials), 500 (server)
router.post('/login', async (req, res) => {
    try {
        const validatedData = await loginSchema.validate(req.body);
        const user = await loginUser(validatedData.username, validatedData.password);
        const token = createUserJWT(user, '7d');
        return res.json({
            message: `Welcome back, ${user.username}!`,
            token,
            user: {
                ...user,
                date_of_birth: new Date(user.date_of_birth).toISOString().split('T')[0]
            }
        });
    } catch (error) {
        if (error.name === 'ValidationError') {
            return res.status(400).json({
                error: 'Please check your input',
                message: 'Username and password are required',
                details: error.errors
            });
        }
        if (error.message === 'Invalid username or password!') {
            return res.status(401).json({
                error: 'Invalid username or password',
                message: 'Please check your credentials and try again'
            });
        }
        if (error.message === 'User account is inactive. Please contact support.') {
            return res.status(401).json({
                error: 'Account inactive',
                message: 'User account is inactive. Please contact support.'
            });
        }
        console.error('Login error:', error);
        return res.status(500).json({
            error: 'Unable to process login',
            message: 'Something went wrong. Please try again later'
        });
    }
});

//=====LOGOUT ROUTE (POST /api/auth/logout)=====
// 1: Use requireAuth middleware (gets token from header)
// 2: Get token from req.token (added by middleware)
// 3: Decode token to get expiry time
// 4: Call blacklistToken(token, expiry) to blacklist it
// 5: Return 204 No Content
// Error handling: 500 (server error)
router.post('/logout', requireAuth, async (req, res) => {
    try {
        const token = req.token;
        const decoded = jwt.decode(token);
        const expiryTime = decoded.exp;
        blacklistToken(token, expiryTime);
        return res.sendStatus(204);
    } catch (error) {
        console.error('Logout error:', error);
        return res.status(500).json({
            error: 'Logout failed',
            message: 'Something went wrong while logging out'
        });
    }
});

//=====LOGOUT ROUTE (GET /api/auth/logout)=====
// Same as POST logout but with GET method
// 1: Use requireAuth middleware
// 2: Get token and blacklist it
// 3: Return 204 No Content
router.get('/logout', requireAuth, async (req, res) => {
    try {
        const token = req.token;
        const decoded = jwt.decode(token);
        const expiryTime = decoded.exp;
        blacklistToken(token, expiryTime);
        return res.sendStatus(204);
    } catch (error) {
        console.error('Logout error:', error);
        return res.status(500).json({
            error: 'Logout failed',
            message: 'Something went wrong while logging out'
        });
    }
});

//=====REGISTER ROUTE (POST /api/register)=====
// 1: Validate request body (username, password, confirmPassword, real_name, date_of_birth)
// 2: Call createUser(username, password, real_name, date_of_birth) from DAO
// 3: Create JWT token using createUserJWT(username, '7d')
// 4: Return 201 Created with location header and user data
// Error handling: 400 (validation), 409 (username taken), 500 (server)
router.post('/register', uploadAvatar, async (req, res) => {
    try {
        const validatedData = await registerSchema.validate(req.body, { abortEarly: false });
        const usernameLower = validatedData.username.toLowerCase();

        let avatarUrl = validatedData.avatar_url;
        if(req.file){
            try {
                avatarUrl = avatarProcess(req);
            } catch (fileError) {
                return res.status(400).json({
                    error: 'File upload failed',
                    message: fileError.message
                });
            }
        }
        if (!avatarUrl) {
            const defaultAvatars = [
                '/default-avatars/arcane-magic.png',
                '/default-avatars/deep-diver.png',
                '/default-avatars/royal-knight.png',
                '/default-avatars/space-explorer.png',
                '/default-avatars/woodland-sasquatch.png'
            ];
            avatarUrl = defaultAvatars[Math.floor(Math.random() * defaultAvatars.length)];
        }
        const user = await createUser(
            usernameLower,
            validatedData.password,
            validatedData.real_name,
            validatedData.date_of_birth,
            validatedData.security_question_id,
            validatedData.security_answer,            
            validatedData.description,
            avatarUrl
        );

        const token = createUserJWT(user, '7d');

        return res.status(201)
            .location(`/api/users/${user.id}`)
            .json({
                message: `Welcome, ${user.username}!`,
                token,
                user: {
                    ...user,
                    date_of_birth: new Date(user.date_of_birth).toISOString().split('T')[0]
                }
            });

    } catch (error) {
        if (error.name === 'ValidationError') {
            return res.status(400).json({
                error: 'Registration validation failed',
                message: 'Please check all required fields and try again',
                details: error.errors
            });
        }
        if (error.message === 'Username already exist!') {
            return res.status(409).json({
                error: 'Username already taken',
                message: 'This username is already in use. Please choose a different one'
            });
        }
        console.error('Registration error:', error);
        return res.status(500).json({
            error: 'Unable to complete registration',
            message: 'Something went wrong. Please try again later'
        });
    }
});

// GET /api/security-questions
router.get("/security-questions", async (req, res) => {
    try {
        const db = await getDatabase();
        const questions = await db.all("SELECT id, question FROM SecurityQuestion");
        res.json(questions);
    } catch (error) {
        console.error('Get security questions error:', error);
        return res.status(500).json({
            error: 'Unable to retrieve security questions',
            message: 'Something went wrong. Please try again later'
        });
    }
});
//=====CHECK USERNAME AVAILABILITY (GET /api/auth/check-username)=====
// Purpose: Real-time username availability check for registration form
// Query params: ?username=xxx
// Returns: { available: true/false }
// Note: Public endpoint - no authentication required
router.get('/check-username', async (req, res) => {
    try {
        const username = (req.query.username || "").toLowerCase();
        
        // Validate username is provided
        if (!username) {
            return res.status(400).json({
                error: 'Username is required',
                available: false
            });
        }
        
        // Validate username length (same as registration requirements)
        if (username.length < 3 || username.length > 32) {
            return res.status(400).json({
                error: 'Username must be between 3 and 32 characters',
                available: false
            });
        }
        
        // Check if username exists in database
        const db = await getDatabase();
        const existingUser = await db.get(
            "SELECT id FROM User WHERE LOWER(username) = ?", 
            username
        );
        
        // Return availability status
        return res.json({
            available: !existingUser  // true if doesn't exist, false if exists
        });
        
    } catch (error) {
        console.error('Username check error:', error);
        return res.status(500).json({
            error: 'Unable to check username availability',
            available: false
        });
    }
});

//=====CREATE ADMIN ROUTE (POST /api/auth/create-admin)=====
// 1: Validate request body (username, password, confirmPassword, real_name, date_of_birth)
// 2: Call createUser(username, password, real_name, date_of_birth) from DAO
// 3: Update user to set is_admin = true
// 4: Create JWT token using createUserJWT(username, '7d')
// 5: Return 201 Created with location header and user data
// Error handling: 400 (validation), 409 (username taken), 500 (server)
router.post('/create-admin', async (req, res) => {
    try {
        const validatedData = await registerSchema.validate(req.body, { abortEarly: false });

        const user = await createUser(
            validatedData.username,
            validatedData.password,
            validatedData.real_name,
            validatedData.date_of_birth,
            validatedData.security_question_id,
            validatedData.security_answer,
            validatedData.description,
            validatedData.avatar_url
        );

        // Update user to admin
        const db = await getDatabase();
        await db.run("UPDATE User SET is_admin = 1 WHERE id = ?", user.id);

        // Get updated user
        const adminUser = await getUserById(user.id);

        const token = createUserJWT(adminUser, '7d');

        return res.status(201)
            .location(`/api/users/${adminUser.id}`)
            .json({
                message: `Admin user created: ${adminUser.username}!`,
                token,
                user: {
                    ...adminUser,
                    date_of_birth: new Date(adminUser.date_of_birth).toISOString().split('T')[0]
                }
            });

    } catch (error) {
        if (error.name === 'ValidationError') {
            return res.status(400).json({
                error: 'Admin creation validation failed',
                message: 'Please check all required fields and try again',
                details: error.errors
            });
        }
        if (error.message === 'Username already exist!') {
            return res.status(409).json({
                error: 'Username already taken',
                message: 'This username is already in use. Please choose a different one'
            });
        }
        console.error('Admin creation error:', error);
        return res.status(500).json({
            error: 'Unable to create admin',
            message: 'Something went wrong. Please try again later'
        });
    }
});

//=====FORGOT PASSWORD - GET SECURITY QUESTION (POST /api/auth/forgot-password/question)=====
// Step 1: Validate request body (username)
// Step 2: Get user's security question from database
// Step 3: Return security question (but NOT the answer!)
// Error handling: 400 (validation), 404 (user not found), 500 (server)
const forgotPasswordQuestionSchema = yup.object({
    username: yup.string().required('Username is required')
}).required();

router.post('/forgot-password/question', async (req, res) => {
    try {
        const validatedData = await forgotPasswordQuestionSchema.validate(req.body);
        const result = await getUserSecurityQuestion(validatedData.username);
        
        return res.json({
            username: result.username,
            security_question_id: result.security_question_id,
            question: result.question
        });
    } catch (error) {
        if (error.name === 'ValidationError') {
            return res.status(400).json({
                error: 'Invalid input',
                message: 'Username is required',
                details: error.errors
            });
        }
        if (error.message === 'User not found') {
            return res.status(404).json({
                error: 'User not found',
                message: 'No account exists with this username'
            });
        }
        console.error('Get security question error:', error);
        return res.status(500).json({
            error: 'Unable to retrieve security question',
            message: 'Something went wrong. Please try again later'
        });
    }
});

//=====FORGOT PASSWORD - VERIFY ANSWER & RESET PASSWORD (POST /api/auth/forgot-password/reset)=====
// Step 1: Validate request body (username, security_answer, new_password, confirm_password)
// Step 2: Verify security answer matches stored answer
// Step 3: If correct, reset password
// Step 4: Return success message
// Error handling: 400 (validation), 401 (wrong answer), 404 (user not found), 500 (server)
const resetPasswordSchema = yup.object({
    username: yup.string().required('Username is required'),
    security_answer: yup.string().required('Security answer is required'),
    new_password: yup.string()
        .matches(/[A-Z]/, 'Password must contain UPPERCASE')
        .matches(/[a-z]/, 'Password must contain lowercase')
        .matches(/[0-9]/, 'Password must contain number')
        .matches(/[^a-zA-Z0-9]/, 'Password must contain symbol')
        .min(8, 'Password must be at least 8 characters')
        .max(255, 'Password must be less than 255 characters')
        .required('New password is required'),
    confirm_password: yup.string()
        .oneOf([yup.ref('new_password')], 'Passwords must match')
        .required('Please confirm your password')
}).required();

router.post('/forgot-password/reset', async (req, res) => {
    try {
        const validatedData = await resetPasswordSchema.validate(req.body, { abortEarly: false });
        
        // Verify security answer
        await verifySecurityAnswer(validatedData.username, validatedData.security_answer);
        
        // Reset password
        await resetUserPassword(validatedData.username, validatedData.new_password);
        
        return res.json({
            message: 'Password reset successful! You can now log in with your new password.',
            success: true
        });
    } catch (error) {
        if (error.name === 'ValidationError') {
            return res.status(400).json({
                error: 'Invalid input',
                message: 'Please check your input and try again',
                details: error.errors
            });
        }
        if (error.message === 'User not found') {
            return res.status(404).json({
                error: 'User not found',
                message: 'No account exists with this username'
            });
        }
        if (error.message === 'Incorrect security answer') {
            return res.status(401).json({
                error: 'Incorrect answer',
                message: 'The security answer you provided is incorrect'
            });
        }
        console.error('Password reset error:', error);
        return res.status(500).json({
            error: 'Unable to reset password',
            message: 'Something went wrong. Please try again later'
        });
    }
});

export default router;
