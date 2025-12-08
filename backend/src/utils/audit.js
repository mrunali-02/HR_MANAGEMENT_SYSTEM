// src/utils/audit.js
import db from '../db/db.js';

/**
 * Log an action to the audit_logs table
 * @param {number|null} userId - User ID performing the action
 * @param {string} action - Action description
 * @param {object} metadata - Additional metadata (will be JSON stringified)
 */
export async function logAudit(userId, action, metadata = {}) {
  try {
    await db.execute(
      'INSERT INTO audit_logs (user_id, action, metadata) VALUES (?, ?, ?)',
      [userId, action, JSON.stringify(metadata)]
    );
  } catch (error) {
    // Don't throw - audit logging should not break the main flow
    console.error('Audit logging error:', error);
  }
}

/**
 * Create a notification for a user
 * @param {number} userId - User ID to notify
 * @param {string} message - Notification message
 */
export async function createNotification(userId, message) {
  try {
    await db.execute(
      'INSERT INTO notifications (user_id, message) VALUES (?, ?)',
      [userId, message]
    );
  } catch (error) {
    console.error('Notification creation error:', error);
  }
}

