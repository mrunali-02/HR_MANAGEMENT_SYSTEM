// src/middlewares/authToken.js
import db from '../db/db.js';

export async function authToken(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.substring(7);

    // 1) Find non-expired token and join employee in one query.
    // Use UTC_TIMESTAMP() in DB for reliable comparison.
    const [rows] = await db.execute(
      `SELECT t.user_id, t.expires_at, e.id, e.email, e.role, e.name
       FROM api_tokens t
       JOIN employees e ON t.user_id = e.id
       WHERE t.token = ? AND t.expires_at > UTC_TIMESTAMP()`,
      [token]
    );

    if (rows.length === 1) {
      const row = rows[0];
      req.user = {
        id: row.id,
        email: row.email,
        role: row.role,
        name: row.name
      };
      req.token = token;
      return next();
    }

    // 2) If not found, check whether token exists (to give clearer message)
    const [maybe] = await db.execute(
      `SELECT expires_at FROM api_tokens WHERE token = ?`,
      [token]
    );

    if (maybe.length === 0) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    // token exists but expired -> delete it and inform client
    const expiresAt = maybe[0].expires_at;
    await db.execute('DELETE FROM api_tokens WHERE token = ?', [token]);

    return res.status(401).json({ error: 'Token expired', expires_at: expiresAt });
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(500).json({ error: 'Authentication error' });
  }
}
