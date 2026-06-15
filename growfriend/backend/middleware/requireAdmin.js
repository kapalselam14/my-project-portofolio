function requireAdmin(req, res, next) {
  const roles = req.auth?.roles || [];
  if (!roles.includes('ADMIN')) {
    return res.status(403).json({
      success: false,
      error: { code: 'FORBIDDEN', message: 'Admin access required', details: {} }
    });
  }
  return next();
}

module.exports = { requireAdmin };
