import rateLimit from 'express-rate-limit';
import db from '../db/db.js';

export const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: async (req, res) => {
    try {
      const [rows] = await db.query('SELECT value FROM settings WHERE category = ?', ['security']);
      if (rows.length > 0) {
        const securitySettings = rows[0].value;
        return securitySettings.maxLoginAttempts || 5;
      }
    } catch (err) {
      console.error('Rate limiter DB error:', err);
    }
    return 5; // Default fallback
  },
  message: { error: 'Too many login attempts, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

