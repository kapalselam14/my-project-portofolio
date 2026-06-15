const jwt = require('jsonwebtoken');
const { sendError } = require('../utils/apiResponse');

function extractToken(req) {
  const raw = req.headers.authorization || req.headers.Authorization || '';
  const auth = String(raw).trim();
  if (!auth) return null;

  // Standard Bearer format
  const bearerMatch = auth.match(/^Bearer\s+(.+)$/i);
  if (bearerMatch) return bearerMatch[1].trim();

  // Raw JWT fallback
  if (auth.split('.').length === 3) return auth;

  return null;
}

function requireAuth(req, res, next) {
  const token = extractToken(req);

  if (!token) {
    return sendError(res, 'Missing or invalid Authorization header', 401);
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.auth = payload;
    req.userId = payload.sub;
    return next();
  } catch (_err) {
    return sendError(res, 'Invalid or expired token', 401);
  }
}

module.exports = { requireAuth };