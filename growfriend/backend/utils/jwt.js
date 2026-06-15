const jwt = require('jsonwebtoken');

function signAccessToken(user) {
  // keep payload minimal but useful
  const payload = {
    sub: user._id.toString(),
    email: user.email,
    roles: user.roles || ['USER']
  };

  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d'
  });
}

module.exports = { signAccessToken };