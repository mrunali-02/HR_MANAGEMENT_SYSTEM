// src/controllers/authController.js
import db from '../db/db.js';
import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';
dotenv.config();

const BCRYPT_SALT_ROUNDS = Number(process.env.BCRYPT_SALT_ROUNDS || 10);
const TOKEN_EXPIRY_HOURS = Number(process.env.TOKEN_EXPIRY_HOURS || 24);

/**
 * POST /login
 * Body: { email, password }
 * Returns: { token, user: { id, email, role, name } }
 */
export async function login(req, res) {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Missing email or password' });
    }

    // Log attempt (remove in production)
    console.log(`Login attempt for email: ${email}`);

    const [rows] = await db.execute(
      'SELECT id, password_hash, email, role, name FROM employees WHERE email = ?',
      [email]
    );

    if (rows.length === 0) {
      console.log(`User not found: ${email}`);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = rows[0];
    console.log(`User found: ${user.email}, role: ${user.role}`);
    
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      console.log(`Password mismatch for user: ${email}`);
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    console.log(`Login successful for user: ${email}`);

    // create token (uuid) and store in DB with expiry computed by MySQL (UTC)
    const token = uuidv4();

    await db.execute(
      `INSERT INTO api_tokens (user_id, token, expires_at) 
       VALUES (?, ?, DATE_ADD(UTC_TIMESTAMP(), INTERVAL ? HOUR))`,
      [user.id, token, TOKEN_EXPIRY_HOURS]
    );

    return res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        name: user.name
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ 
      error: 'Login failed',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}

/**
 * POST /logout
 * Protected route using authToken middleware; it will set req.token
 */
export async function logout(req, res) {
  try {
    const token = req.token;
    if (!token) return res.status(400).json({ error: 'No token provided' });

    await db.execute('DELETE FROM api_tokens WHERE token = ?', [token]);
    return res.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    return res.status(500).json({ error: 'Logout failed' });
  }
}

/**
 * GET /me
 * Protected route - returns current user info and profile
 */
export async function getMe(req, res) {
  try {
    const userId = req.user.id;

    // Get user info
    const [users] = await db.execute(
      'SELECT id, email, role, name, created_at FROM employees WHERE id = ?',
      [userId]
    );

    if (users.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = users[0];

    // Get profile
    const [profiles] = await db.execute(
      'SELECT display_name, bio FROM profiles WHERE user_id = ?',
      [userId]
    );

    const profile = profiles.length > 0 ? profiles[0] : null;

    res.json({
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        name: user.name,
        created_at: user.created_at
      },
      profile
    });
  } catch (error) {
    console.error('Get me error:', error);
    res.status(500).json({ error: 'Failed to fetch user info' });
  }
}

/**
 * Optional helper to create admin programmatically (used by a migration script or admin CLI)
 * Creates admin only if not exists. Pass plain password; function hashes it.
 */
export async function ensureAdmin(email, plainPassword, name = 'Admin') {
  if (!email || !plainPassword) throw new Error('admin email and password required');

  const [existing] = await db.execute('SELECT id FROM employees WHERE email = ?', [email]);
  if (existing.length > 0) {
    console.log('Admin already exists, skipping creation.');
    return existing[0].id;
  }

  const passwordHash = await bcrypt.hash(plainPassword, BCRYPT_SALT_ROUNDS);

  const [result] = await db.execute(
    'INSERT INTO employees (email, password_hash, name, role) VALUES (?, ?, ?, ?)',
    [email, passwordHash, name, 'admin']
  );

  console.log('Created admin with id:', result.insertId);
  return result.insertId;
}
