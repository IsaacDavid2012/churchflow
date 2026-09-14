const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const {
  JWT_REFRESH_SECRET,
  generateAccessToken,
  generateRefreshToken,
  authMiddleware,
  requireRole,
} = require('../middleware/auth');
const { ROLES } = require('../../../shared/roles');

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { username, email, password } = req.body;
  const identifier = (username || email || '').trim();

  if (!identifier || !password) {
    return res.status(400).json({ error: 'Username/Email and password are required' });
  }

  try {
    const result = await db.query(
      `SELECT id, email, username, password_hash, role, name, status, force_password_reset 
       FROM users 
       WHERE LOWER(username) = LOWER($1) OR (email IS NOT NULL AND LOWER(email) = LOWER($1))`,
      [identifier]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];

    if (user.status === 'disabled') {
      return res.status(403).json({ error: 'This account has been disabled. Please contact an administrator.' });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    // Store or track refresh token if table exists
    try {
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      const tokenHash = await bcrypt.hash(refreshToken.slice(-16), 5);
      await db.query(
        `INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)`,
        [user.id, tokenHash, expiresAt]
      );
    } catch (e) {
      // Non-fatal if refresh_tokens table not yet initialized in memory mock
    }

    res.json({
      token,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
        name: user.name,
        status: user.status,
        force_password_reset: user.force_password_reset,
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/auth/refresh
router.post('/refresh', async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    return res.status(400).json({ error: 'Refresh token is required' });
  }

  try {
    const decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET);
    if (decoded.tokenType !== 'refresh') {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }

    const userRes = await db.query(
      'SELECT id, email, username, role, name, status FROM users WHERE id = $1',
      [decoded.id]
    );

    if (userRes.rows.length === 0) {
      return res.status(401).json({ error: 'User no longer exists' });
    }

    const user = userRes.rows[0];
    if (user.status === 'disabled') {
      return res.status(403).json({ error: 'Account disabled' });
    }

    const newAccessToken = generateAccessToken(user);
    res.json({ token: newAccessToken });
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired refresh token' });
  }
});

// GET /api/auth/me
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT id, email, username, role, name, status, force_password_reset, created_at FROM users WHERE id = $1',
      [req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ user: result.rows[0] });
  } catch (err) {
    console.error('Auth check error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/auth/register (Admin or Pastor only, or bootstrapping first user)
router.post('/register', async (req, res) => {
  const { username, email, password, name, role = ROLES.VOLUNTEER } = req.body;

  if (!username || !password || !name) {
    return res.status(400).json({ error: 'Username, password, and name are required' });
  }

  try {
    // Check if any users exist in DB (bootstrap mode)
    const userCountRes = await db.query('SELECT COUNT(*) FROM users');
    const totalUsers = parseInt(userCountRes.rows[0].count, 10);

    // If users already exist, require admin or pastor auth
    if (totalUsers > 0) {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized: Admin authentication required to register new users' });
      }
      try {
        const decoded = jwt.verify(authHeader.split(' ')[1], process.env.JWT_SECRET || 'servesync_jwt_super_secret_key_2026');
        if (decoded.role !== ROLES.ADMIN && decoded.role !== ROLES.PASTOR) {
          return res.status(403).json({ error: 'Forbidden: Only Admin or Pastor can create users' });
        }
      } catch (err) {
        return res.status(401).json({ error: 'Unauthorized: Invalid token' });
      }
    }

    // Check for duplicate username or email
    const duplicateCheck = await db.query(
      'SELECT id FROM users WHERE LOWER(username) = LOWER($1) OR (email IS NOT NULL AND LOWER(email) = LOWER($2))',
      [username.trim(), (email || '').trim()]
    );

    if (duplicateCheck.rows.length > 0) {
      return res.status(409).json({ error: 'A user with that username or email already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const assignedRole = totalUsers === 0 ? ROLES.ADMIN : role;

    const insertRes = await db.query(
      `INSERT INTO users (username, email, password_hash, name, role, status)
       VALUES ($1, $2, $3, $4, $5, 'active')
       RETURNING id, username, email, name, role, status, created_at`,
      [username.trim(), email ? email.trim() : null, passwordHash, name.trim(), assignedRole]
    );

    const newUser = insertRes.rows[0];
    const token = generateAccessToken(newUser);
    const refreshToken = generateRefreshToken(newUser);

    res.status(201).json({
      message: 'User created successfully',
      user: newUser,
      token,
      refreshToken,
    });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// POST /api/auth/change-password
router.post('/change-password', authMiddleware, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Current password and new password are required' });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'New password must be at least 6 characters long' });
  }

  try {
    const userRes = await db.query('SELECT id, password_hash FROM users WHERE id = $1', [req.user.id]);
    if (userRes.rows.length === 0) return res.status(404).json({ error: 'User not found' });

    const isMatch = await bcrypt.compare(currentPassword, userRes.rows[0].password_hash);
    if (!isMatch) {
      return res.status(400).json({ error: 'Current password is incorrect' });
    }

    const newHash = await bcrypt.hash(newPassword, 10);
    await db.query('UPDATE users SET password_hash = $1, force_password_reset = false, updated_at = NOW() WHERE id = $2', [
      newHash,
      req.user.id,
    ]);

    res.json({ success: true, message: 'Password updated successfully' });
  } catch (err) {
    console.error('Change password error:', err);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

// GET /api/auth/users (Admin & Pastor only)
router.get('/users', authMiddleware, requireRole([ROLES.ADMIN, ROLES.PASTOR]), async (req, res) => {
  try {
    const result = await db.query(
      'SELECT id, username, email, name, role, status, force_password_reset, created_at, updated_at FROM users ORDER BY created_at ASC'
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Fetch users error:', err);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// POST /api/auth/users (Admin only - create new user)
router.post('/users', authMiddleware, requireRole(ROLES.ADMIN), async (req, res) => {
  const { username, email, password, name, role = ROLES.VOLUNTEER, status = 'active' } = req.body;

  if (!username || !password || !name) {
    return res.status(400).json({ error: 'Username, password, and name are required' });
  }

  try {
    const duplicateCheck = await db.query(
      'SELECT id FROM users WHERE LOWER(username) = LOWER($1) OR (email IS NOT NULL AND LOWER(email) = LOWER($2))',
      [username.trim(), (email || '').trim()]
    );

    if (duplicateCheck.rows.length > 0) {
      return res.status(409).json({ error: 'A user with that username or email already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const insertRes = await db.query(
      `INSERT INTO users (username, email, password_hash, name, role, status)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, username, email, name, role, status, created_at`,
      [username.trim(), email ? email.trim() : null, passwordHash, name.trim(), role, status]
    );

    res.status(201).json({ success: true, message: 'User created successfully', user: insertRes.rows[0] });
  } catch (err) {
    console.error('Create user error:', err);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// PUT /api/auth/users/:id (Admin only - update user details or password)
router.put('/users/:id', authMiddleware, requireRole(ROLES.ADMIN), async (req, res) => {
  const { id } = req.params;
  const { role, status, name, email, username, password } = req.body;

  try {
    let passwordHash = null;
    if (password && password.trim().length > 0) {
      passwordHash = await bcrypt.hash(password.trim(), 10);
    }

    const result = await db.query(
      `UPDATE users 
       SET 
         role = COALESCE($1, role),
         status = COALESCE($2, status),
         name = COALESCE($3, name),
         email = COALESCE($4, email),
         username = COALESCE($5, username),
         password_hash = CASE WHEN $6::text IS NOT NULL THEN $6::text ELSE password_hash END,
         updated_at = NOW()
       WHERE id = $7
       RETURNING id, username, email, name, role, status, updated_at`,
      [role, status, name, email, username, passwordHash, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ success: true, user: result.rows[0] });
  } catch (err) {
    console.error('Update user error:', err);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// POST /api/auth/users/:id/reset-password (Admin only)
router.post('/users/:id/reset-password', authMiddleware, requireRole(ROLES.ADMIN), async (req, res) => {
  const { id } = req.params;
  const { newPassword } = req.body;

  if (!newPassword || newPassword.length < 6) {
    return res.status(400).json({ error: 'New password must be at least 6 characters' });
  }

  try {
    const newHash = await bcrypt.hash(newPassword, 10);
    const result = await db.query(
      'UPDATE users SET password_hash = $1, force_password_reset = false, updated_at = NOW() WHERE id = $2 RETURNING id, username, name',
      [newHash, id]
    );

    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json({ success: true, message: `Password reset successfully for ${result.rows[0].name}` });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

// DELETE /api/auth/users/:id (Admin only)
router.delete('/users/:id', authMiddleware, requireRole(ROLES.ADMIN), async (req, res) => {
  const { id } = req.params;

  try {
    if (req.user.id === id) {
      return res.status(400).json({ error: 'You cannot delete your own active account.' });
    }

    const result = await db.query('DELETE FROM users WHERE id = $1 RETURNING id, username, name', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ success: true, message: `User ${result.rows[0].name} deleted successfully.` });
  } catch (err) {
    console.error('Delete user error:', err);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

module.exports = router;
