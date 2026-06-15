import express from 'express';
import * as yup from 'yup';
import {
    getUserById,
    getAllUsers,
    updateUser,
    changePassword,
    softDeleteUser,
    hardDeleteUserAndRelated
} from '../../data/user-dao.js';
import { requireAuth, requireAdmin, requireSelfOrAdmin } from '../../middleware/auth-middleware.js';
import { uploadAvatar, avatarProcess } from '../../middleware/upload-middleware.js';
import {getTopAuthorsByLikes } from '../../data/topauthors-dao.js';
import { getTopArticlesByUser, getUserStats } from '../../data/user-stats-dao.js';

const router = express.Router();

//=====VALIDATION SCHEMAS=====

// TODO: Create updateProfileSchema
// Fields needed (all optional - user can update any combination):
//   - username: string, min 3, max 20
//   - real_name: string, min 2
//   - date_of_birth: date, max today
//   - description: string, nullable
//   - avatar_url: string, valid URL, nullable

const updateProfileSchema = yup.object({
    username: yup.string().min(3).max(32),
    real_name: yup.string().min(2).max(64),
    date_of_birth: yup.date().max(new Date()),
    description: yup.string().nullable(),
    avatar_url: yup.string().nullable()
}).required();

// TODO: Create updatePasswordSchema
// Fields needed:
//   - oldPassword: string, required
//   - newPassword: string, required, min 8

const updatePasswordSchema = yup.object({
    oldPassword: yup.string().required(),
    newPassword: yup.string()
        .min(8)
        .matches(/[A-Z]/, 'Password must contain UPPERCASE')
        .matches(/[a-z]/, 'Password must contain lowercase')
        .matches(/[0-9]/, 'Password must contain number')
        .matches(/[^a-zA-Z0-9]/, 'Password must contain symbol')
        .required()
}).required();

//=====GET DEFAULT AVATARS=====
// GET /api/users/avatars
// Purpose: Return list of default avatar options for registration
// Public endpoint - no authentication required
router.get('/avatars', async (req, res) => {
    try {
        // List of default avatar options
        const avatars = [
            { id: 1, name: 'Arcane Mage', url: '/default-avatars/arcane-magic.png' },
            { id: 2, name: 'Deep Diver', url: '/default-avatars/deep-diver.png' },
            { id: 3, name: 'Royal Knight', url: '/default-avatars/royal-knight.png' },
            { id: 4, name: 'Space Explorer', url: '/default-avatars/space-explorer.png' },
            { id: 5, name: 'Woodland Sasquatch', url: '/default-avatars/woodland-sasquatch.png' }
        ];
        
        return res.json(avatars);
        
    } catch (error) {
        console.error('Get avatars error:', error);
        return res.status(500).json({
            error: 'Unable to retrieve avatars',
            message: 'Something went wrong while fetching avatar options'
        });
    }
});

// GET /api/users/top-authors
// Public endpoint to get authors by LIKES
router.get('/top-authors', async (req, res) =>{
    try{
        const limit = parseInt(req.query.limit) || 3;
        const topAuthors = await getTopAuthorsByLikes(limit);
        return res.json(topAuthors); 
    }catch(error){
        console.error('Get top authors error:', error);
        return res.status(500).json({
            error: 'Unable to retrieve top authors',
            message: 'Something went wrong while fetching top authors'
        });
    }
});

//=====GET ALL USERS=====

// TODO: GET /api/users
// Route: router.get('/users', async (req, res) => { ... })
// Steps:
//   1. Call getAllUsers(req.query)  ← Pass query params for filtering!
//      Query params can be: username, real_name, date_of_birth, description, avatar_url, is_admin or is_active
//   2. Return array of users (no wrapper, just the array)
//   3. Error handling:
//      - Catch any errors → 500
router.get('/', requireAuth, requireAdmin, async (req, res) => {
    try {
        const users = await getAllUsers(req.query);
        return res.json(users);
    } catch (error) {
        console.error('Get all users error:', error);
        return res.status(500).json({
            error: 'Unable to retrieve users',
            message: 'Something went wrong while fetching users. Please try again later'
        });
    }
});

// GET /api/users/:id/public
// Returns only real_name and avatar_url for author display
router.get('/:id/public', async (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        if (isNaN(userId)) {
            return res.status(400).json({ error: "Invalid user ID" });
        }
        const user = await getUserById(userId);
        
        // Check if user is active (not deleted)
        if (!user.is_active) {
            return res.status(404).json({ 
                error: "User not found",
                message: "This account has been deleted"
            });
        }
        
        return res.json({
            id: user.id,
            username: user.username,
            real_name: user.real_name,
            avatar_url: user.avatar_url,
            description: user.description,
            date_of_birth: user.date_of_birth
        });
    } catch (error) {
        if (error.message && error.message.includes('does not exists')) {
            return res.status(404).json({ error: "User not found" });
        }
        return res.status(500).json({ error: "Unable to fetch user", details: error.message });
    }
});

// GET /api/users/:id/stats
// Public endpoint to get user statistics
router.get('/:id/stats', async (req, res) =>{
    try {
        const userId = parseInt(req.params.id);
        if(isNaN(userId)){
            return res.status(400).json({
                error: 'Invalid user ID',
                message: 'User ID must be a valid number'
            });
        }
        
        // Check if user exists and is active
        const user = await getUserById(userId);
        if (!user.is_active) {
            return res.status(404).json({ 
                error: "User not found",
                message: "This account has been deleted"
            });
        }
        
        const stats = await getUserStats(userId);
        const topArticles = await getTopArticlesByUser(userId, 1);

        return res.json({
            ...stats,
            top_articles: topArticles
        });
    
    } catch (error) {
        console.error('Get user stats error:', error);
        if (error.message && error.message.includes('does not exists')) {
            return res.status(404).json({ error: "User not found" });
        }
        return res.status(500).json({
            error: 'Unable to fetch user stats',
            message: 'Something went wrong while fetching statistics'
        });
    }
}
)

//=====GET USER BY ID=====

// TODO: GET /api/users/:id
// Route: router.get('/users/:id', async (req, res) => { ... })
// Steps:
//   1. Parse userId from req.params.id (parseInt)
//   2. Check if isNaN(userId) → return 400 with 'Invalid user ID'
//   3. Call getUserById(userId)
//      Note: DAO throws error if user not found, doesn't return null
//   4. Return user object directly
//   5. Error handling:
//      - error.message.includes('does not exists') → 404 with 'User not found'
//      - Other errors → 500
router.get('/:id', requireAuth, requireSelfOrAdmin, async (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        if (isNaN(userId)) {
            return res.status(400).json({
                error: 'Invalid user ID format',
                message: 'User ID must be a valid number'
            });
        }

        const user = await getUserById(userId);
        
        // Check if user is active (not deleted)
        if (!user.is_active) {
            return res.status(404).json({ 
                error: "User not found",
                message: "This account has been deleted"
            });
        }
        
        return res.json({
            ...user,
            date_of_birth: new Date(user.date_of_birth).toISOString().split('T')[0]
        });

    } catch (error) {
        if (error.message.includes('does not exists')) {
            return res.status(404).json({
                error: 'User not found',
                message: `No user exists with ID ${req.params.id}`
            });
        }
        console.error('Get user by ID error:', error);
        return res.status(500).json({
            error: 'Unable to retrieve user',
            message: 'Something went wrong while fetching user details. Please try again later'
        });
    }
});

//=====UPDATE USER PROFILE=====

// TODO: PUT /api/users/:id
// Route: router.put('/users/:id', async (req, res) => { ... })
// Steps:
//   1. Parse userId from req.params.id (parseInt)
//   2. Check if isNaN(userId) → return 400
//   3. Validate req.body with updateProfileSchema (abortEarly: false)
//   4. Call updateUser(userId, validatedData)
//      Note: DAO calls getUserById internally, which throws if not found
//   5. Return { message: 'Profile updated successfully', user: updatedUser }
//   6. Error handling:
//      - ValidationError → 400 with validation details
//      - error.message.includes('does not exists') → 404 with 'User not found'
//      - error.message === 'Username already taken!' → 409
//      - Other errors → 500
router.put('/:id', requireAuth, requireSelfOrAdmin, async (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        if (isNaN(userId)) {
            return res.status(400).json({
                error: 'Invalid user ID format',
                message: 'User ID must be a valid number'
            });
        }

        const validatedData = await updateProfileSchema.validate(req.body, { abortEarly: false });
        const updatedUser = await updateUser(userId, validatedData);

        return res.json({
            message: 'Your profile has been updated successfully',
            user: {
                ...updatedUser,
                date_of_birth: new Date(updatedUser.date_of_birth).toISOString().split('T')[0]
            }
        });

    } catch (error) {
        if (error.name === 'ValidationError') {
            return res.status(400).json({
                error: 'Profile validation failed',
                message: 'Please check your input and try again',
                details: error.errors
            });
        }
        if (error.message.includes('does not exists')) {
            return res.status(404).json({
                error: 'User not found',
                message: `No user exists with ID ${req.params.id}`
            });
        }
        if (error.message === 'Username already taken!') {
            return res.status(409).json({
                error: 'Username already taken',
                message: 'This username is already in use. Please choose a different one'
            });
        }
        console.error('Update user error:', error);
        return res.status(500).json({
            error: 'Unable to update profile',
            message: 'Something went wrong while updating your profile. Please try again later'
        });
    }
});


//=====UPDATE PASSWORD=====

// TODO: PUT /api/users/:id/password
// Route: router.put('/users/:id/password', async (req, res) => { ... })
// Steps:
//   1. Parse userId from req.params.id (parseInt)
//   2. Check if isNaN(userId) → return 400
//   3. Validate req.body with updatePasswordSchema
//   4. Call changePassword(userId, validatedData.oldPassword, validatedData.newPassword)
//   5. Return { message: 'Password updated successfully' }
//   6. Error handling:
//      - ValidationError → 400 with validation details
//      - error.message === 'User does not exist' → 404 with 'User not found'
//      - error.message === 'Wrong Password!' → 401 with 'Current password is incorrect'
//      - Other errors → 500
router.put('/:id/password', requireAuth, requireSelfOrAdmin, async (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        if (isNaN(userId)) {
            return res.status(400).json({
                error: 'Invalid user ID format',
                message: 'User ID must be a valid number'
            });
        }

        const validatedData = await updatePasswordSchema.validate(req.body);
        await changePassword(userId, validatedData.oldPassword, validatedData.newPassword);

        return res.json({
            message: 'Your password has been changed successfully',
            tip: 'Please use your new password for future logins'
        });

    } catch (error) {
        if (error.name === 'ValidationError') {
            return res.status(400).json({
                error: 'Password validation failed',
                message: 'Please ensure your new password meets all requirements',
                details: error.errors
            });
        }
        if (error.message === 'User does not exist') {
            return res.status(404).json({
                error: 'User not found',
                message: `No user exists with ID ${req.params.id}`
            });
        }
        if (error.message === 'Wrong Password!') {
            return res.status(401).json({
                error: 'Current password is incorrect',
                message: 'The current password you entered does not match our records. Please try again'
            });
        }
        console.error('Change password error:', error);
        return res.status(500).json({
            error: 'Unable to change password',
            message: 'Something went wrong while changing your password. Please try again later'
        });
    }
});


//=====DELETE USER=====

// TODO: DELETE /api/users/:id 
// Route: router.delete('/users/:id', async (req, res) => { ... })
// Steps:
//   1. Parse userId from req.params.id (parseInt)
//   2. Check if isNaN(userId) → return 400
//   3. Check req.query.mode:
//        - If 'soft' or not provided → call softDeleteUser(userId)
//        - If 'hard' → call hardDeleteUserAndRelated(userId)
//   4. For soft delete → return { message: 'User account has been deleted successfully' }
//      For hard delete → return 204 No Content
//   5. Error handling:
//      - error.message.includes('does not exists') → 404 with 'User not found'
//      - Other errors → 500
router.delete('/:id', requireAuth, requireSelfOrAdmin, async (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        if (isNaN(userId)) {
            return res.status(400).json({
                error: 'Invalid user ID format',
                message: 'User ID must be a valid number'
            });
        }
        const mode = req.query.mode || 'hard'; //default to hard delete
        if (mode === 'hard') {
            // Only allow admin to perform hard delete
            if (!req.user.is_admin) {
                return res.status(403).json({
                    error: 'Forbidden',
                    message: 'Only administrators can perform hard delete.'
                });
            }
            console.log(`Performing hard delete for user ID ${userId} by admin ID ${req.user.id}`);
            await hardDeleteUserAndRelated(userId);
            return res.status(204).send();
        } else {
            await softDeleteUser(userId);
            return res.json({
                message: 'User account has been deleted successfully',
            });
        }
    } catch (error) {
        if (error.message.includes('does not exists')) {
            return res.status(404).json({
                error: 'User not found',
                message: `No user exists with ID ${req.params.id}`
            });
        }
        console.error('Delete user error:', error);
        return res.status(500).json({
            error: 'Unable to delete user',
            message: 'Something went wrong while deleting the user. Please try again later'
        });
    }
});

//=====UPLOAD CUSTOM AVATAR=====
// POST /api/users/:id/avatar
// Purpose: Upload custom avatar for authenticated user
// Requires: Authentication, user must be self or admin
// Uses: multipart/form-data with field name 'avatar'
router.post('/:id/avatar', requireAuth, requireSelfOrAdmin, uploadAvatar, async (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        if (isNaN(userId)) {
            return res.status(400).json({
                error: 'Invalid user ID format',
                message: 'User ID must be a valid number'
            });
        }

        // Process and validate the uploaded avatar
        const avatarUrl = avatarProcess(req);

        // Update user's avatar_url in database
        const updatedUser = await updateUser(userId, { avatar_url: avatarUrl });

        return res.json({
            message: 'Avatar uploaded successfully',
            avatar_url: avatarUrl
        });

    } catch (error) {
        if (error.message === 'No file uploaded') {
            return res.status(400).json({
                error: 'No file provided',
                message: 'Please select an image file to upload'
            });
        }
        if (error.message === 'Only JPEG and PNG images are allowed') {
            return res.status(400).json({
                error: 'Invalid file type',
                message: 'Please upload a JPEG or PNG image'
            });
        }
        if (error.message.includes('does not exists')) {
            return res.status(404).json({
                error: 'User not found',
                message: `No user exists with ID ${req.params.id}`
            });
        }
        console.error('Upload avatar error:', error);
        return res.status(500).json({
            error: 'Unable to upload avatar',
            message: 'Something went wrong while uploading your avatar. Please try again later'
        });
    }
});





export default router;
