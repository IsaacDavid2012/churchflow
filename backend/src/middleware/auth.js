const jwt = require('jsonwebtoken');
const { ROLES, hasRole } = require('../../../shared/roles');

const JWT_SECRET = process.env.JWT_SECRET || 'servesync_jwt_super_secret_key_2026';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'servesync_jwt_refresh_secret_key_2026';

const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY = '7d';

/**
 * Generate Access Token (short-lived)
 */
function generateAccessToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      username: user.username,
      role: user.role || ROLES.VOLUNTEER,
      name: user.name,
      status: user.status || 'active',
    },
    JWT_SECRET,
    { expiresIn: ACCESS_TOKEN_EXPIRY }
  );
}

/**
 * Generate Refresh Token (long-lived)
 */
function generateRefreshToken(user) {
  return jwt.sign(
    {
      id: user.id,
      tokenType: 'refresh',
    },
    JWT_REFRESH_SECRET,
    { expiresIn: REFRESH_TOKEN_EXPIRY }
  );
}

/**
 * Legacy compatibility helper
 */
function generateToken(user) {
  return generateAccessToken(user);
}

/**
 * Verify JWT middleware
 */
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: No token provided' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.status === 'disabled') {
      return res.status(403).json({ error: 'Account is disabled. Please contact an administrator.' });
    }
    req.user = decoded;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired', code: 'TOKEN_EXPIRED' });
    }
    return res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
}

/**
 * Require specific role(s) middleware
 * e.g. requireRole(['admin', 'pastor']) or requireRole('admin')
 */
function requireRole(roles) {
  const allowed = Array.isArray(roles) ? roles : [roles];
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized: Authentication required' });
    }

    if (!hasRole(req.user.role, allowed)) {
      return res.status(403).json({
        error: `Forbidden: Requires role '${allowed.join(' or ')}'`,
        userRole: req.user.role,
      });
    }

    next();
  };
}

module.exports = {
  JWT_SECRET,
  JWT_REFRESH_SECRET,
  generateAccessToken,
  generateRefreshToken,
  generateToken,
  authMiddleware,
  requireAuth: authMiddleware,
  requireRole,
};
