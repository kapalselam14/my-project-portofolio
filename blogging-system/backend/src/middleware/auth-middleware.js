import {getUsernameFromJWT} from '../utils/jwt-utils.js';
import { getUserByUsername} from '../data/user-dao.js';
import { isTokenBlacklisted } from '../data/token-blacklist.js';

//=====REQUIRE AUTH MIDDLEWARE=====
// Step 1: Extract Authorization header from request
// Step 2: Check if header exists and starts with "Bearer "
// Step 3: Extract token from "Bearer TOKEN" format
// Step 4: Check if token is blacklisted (user logged out)
// Step 5: Verify JWT token and get username
// Step 6: Load full user data from database
// Step 7: Attach user and token to request object
// Step 8: Call next() to continue to route handler
export async function requireAuth(req, res, next) {
    try {
        const authHeader = req.headers.authorization;
        if(!authHeader || !authHeader.startsWith('Bearer ')){
            return res.status(401).json({
                error: 'Authentication required',
                message: 'No token provided. Please login'
            });
        }
        const token = authHeader.split(' ')[1];
        if(isTokenBlacklisted(token)){
            return res.status(401).json({
                error: 'Token revoked',
                message: 'This token has been logged out. Please login again'
            });
        }

        const username = getUsernameFromJWT(token);
        const user = await getUserByUsername(username);
        if(!user){
            return res.status(401).json({
                code: 'ACCOUNT_NOT_FOUND',
                error: 'Account not found',
                message: 'Your account no longer exists.'
            });
        }
        if(!user.is_active){
            return res.status(401).json({
                code: 'ACCOUNT_DELETED',
                error: 'Account disabled',
                message: 'Your account has been deactivated by an administrator.'
            });
        }
        req.user = user;
        req.token = token;
        next();
    } catch (error) {
        if(error.name === 'JsonWebTokenError'){
            return res.status(401).json({
                error: 'Invalid token',
                message: 'Your session is invalid. Please login again'
            });
        }
        if(error.name === 'TokenExpiredError'){
            return res.status(401).json({
                error: 'Token expired',
                message: 'Your session has expired. Please login again'
            });
        }
        console.error('Auth middleware error:', error);
        return res.status(500).json({
            error: 'Authentication failed',
            message: 'Unable to verify authentication'
        });
    }
}

//=====REQUIRE ADMIN MIDDLEWARE=====
// Step 1: Check if user is authenticated (req.user exists)
// Step 2: Check if user has admin privileges (is_admin = true)
// Step 3: Allow access if admin, deny if not admin
export function requireAdmin(req, res, next) {
    if (!req.user) {
        return res.status(401).json({
            error: 'Authentication required',
            message: 'Please login first'
        });
    }
    
    if (!req.user.is_admin) {
        return res.status(403).json({
            error: 'Forbidden',
            message: 'This action requires administrator privileges'
        });
    }
    
    next();
}

//=====REQUIRE SELF OR ADMIN MIDDLEWARE=====
// Step 1: Check if user is authenticated (req.user exists)
// Step 2: Get target user ID from URL parameters
// Step 3: Check if user is accessing their own resource OR is admin
// Step 4: Allow access if self or admin, deny if neither
export function requireSelfOrAdmin(req, res, next) {
    if (!req.user) {
        return res.status(401).json({
            error: 'Authentication required',
            message: 'Please login first'
        });
    }
    
    const targetUserId = parseInt(req.params.id);
    
    if (req.user.id === targetUserId || req.user.is_admin) {
        next();
    } else {
        return res.status(403).json({
            error: 'Forbidden',
            message: 'You can only modify your own profile'
        });
    }
}