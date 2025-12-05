import db from '../db/db.js';

const isSelfOrAdmin = (reqUser, targetUserId) =>
  reqUser.role === 'admin' || reqUser.id === targetUserId;

const formatTime = (timeValue) => {
  if (!timeValue) return null;
  if (typeof timeValue === 'string') return timeValue.substring(0, 5);
  return timeValue.toString().substring(0, 5);
};

const formatDate = (dateValue) => {
  if (!dateValue) return null;
  if (typeof dateValue === 'string') return dateValue.substring(0, 10);
  const iso = dateValue.toISOString();
  return iso.substring(0, 10);
};

export async function getUserProfile(req, res) {
  try {
    const { role, id } = req.params;
    const userId = parseInt(id, 10);

    if (!isSelfOrAdmin(req.user, userId)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (!['employee', 'manager', 'hr', 'admin'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    const [users] = await db.execute(
      'SELECT id, email, role, name, department, phone, joined_on, created_at FROM employees WHERE id = ? AND role = ?',
      [userId, role]
    );

    if (users.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = users[0];
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
        department: user.department,
        phone: user.phone,
        joined_on: user.joined_on,
        created_at: user.created_at
      },
      profile
    });
  } catch (error) {
    console.error('Get user profile error:', error);
    res.status(500).json({ error: 'Failed to fetch user profile' });
  }
}

export async function updateProfile(req, res) {
  try {
    const userId = req.user.id;
    const { display_name, bio } = req.body;

    const [profiles] = await db.execute(
      'SELECT id FROM profiles WHERE user_id = ?',
      [userId]
    );

    if (profiles.length === 0) {
      await db.execute(
        'INSERT INTO profiles (user_id, display_name, bio) VALUES (?, ?, ?)',
        [userId, display_name || null, bio || null]
      );
    } else {
      await db.execute(
        'UPDATE profiles SET display_name = ?, bio = ? WHERE user_id = ?',
        [display_name || null, bio || null, userId]
      );
    }

    res.json({ message: 'Profile updated successfully' });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
}

export async function getAttendance(req, res) {
  try {
    const userId = parseInt(req.params.id, 10);
    if (!isSelfOrAdmin(req.user, userId)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const [records] = await db.execute(
      `SELECT attendance_date, status, check_in_time, check_out_time
       FROM attendance
       WHERE user_id = ? AND attendance_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
       ORDER BY attendance_date DESC`,
      [userId]
    );

    const [todayRows] = await db.execute(
      `SELECT attendance_date, status, check_in_time, check_out_time
       FROM attendance
       WHERE user_id = ? AND attendance_date = CURDATE()
       LIMIT 1`,
      [userId]
    );

    const mapRow = (row) => ({
      date: formatDate(row.attendance_date),
      status: row.status,
      check_in: formatTime(row.check_in_time),
      check_out: formatTime(row.check_out_time)
    });

    res.json({
      today: todayRows.length ? mapRow(todayRows[0]) : null,
      records: records.map(mapRow)
    });
  } catch (error) {
    console.error('Get attendance error:', error);
    res.status(500).json({ error: 'Failed to fetch attendance' });
  }
}

export async function markAttendance(req, res) {
  try {
    const userId = parseInt(req.params.id, 10);
    if (!isSelfOrAdmin(req.user, userId)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const [existing] = await db.execute(
      'SELECT id FROM attendance WHERE user_id = ? AND attendance_date = CURDATE()',
      [userId]
    );

    if (existing.length > 0) {
      return res.status(400).json({ error: 'Attendance already marked for today' });
    }

    const now = new Date();
    const nowTime = now.toTimeString().substring(0, 8);

    await db.execute(
      `INSERT INTO attendance (user_id, attendance_date, status, check_in_time)
       VALUES (?, CURDATE(), 'present', ?)`,
      [userId, nowTime]
    );

    res.json({ message: 'Attendance marked successfully' });
  } catch (error) {
    console.error('Mark attendance error:', error);
    res.status(500).json({ error: 'Failed to mark attendance' });
  }
}

export async function getLeaveBalance(req, res) {
  try {
    const userId = parseInt(req.params.id, 10);
    if (!isSelfOrAdmin(req.user, userId)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const base = {
      total: 0,
      used: 0,
      sick: 0,
      casual: 0,
      paid: 0,
      emergency: 0
    };

    const [policies] = await db.execute(
      'SELECT type, total_days FROM leave_policies'
    );
    policies.forEach((policy) => {
      base[policy.type] = policy.total_days;
      base.total += policy.total_days;
    });

    const [usedRows] = await db.execute(
      `SELECT type, COALESCE(SUM(DATEDIFF(end_date, start_date) + 1), 0) AS days
       FROM leave_requests
       WHERE user_id = ? AND status = 'approved'
       GROUP BY type`,
      [userId]
    );
    usedRows.forEach((row) => {
      base.used += row.days;
      const key = row.type;
      if (typeof base[key] === 'number') {
        base[key] = Math.max(base[key] - row.days, 0);
      }
    });

    res.json(base);
  } catch (error) {
    console.error('Get leave balance error:', error);
    res.status(500).json({ error: 'Failed to fetch leave balance' });
  }
}

export async function getLeaveHistory(req, res) {
  try {
    const userId = parseInt(req.params.id, 10);
    if (!isSelfOrAdmin(req.user, userId)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const [rows] = await db.execute(
      `SELECT id, type, start_date, end_date, reason, status, created_at
       FROM leave_requests
       WHERE user_id = ?
       ORDER BY created_at DESC`,
      [userId]
    );

    res.json({ leaves: rows });
  } catch (error) {
    console.error('Get leave history error:', error);
    res.status(500).json({ error: 'Failed to fetch leave history' });
  }
}

export async function createLeaveRequest(req, res) {
  try {
    const userId = parseInt(req.params.id, 10);
    if (!isSelfOrAdmin(req.user, userId)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { type, start_date, end_date, reason } = req.body;
    if (!type || !start_date || !end_date || !reason) {
      return res.status(400).json({ error: 'Missing leave details' });
    }

    const start = new Date(start_date);
    const end = new Date(end_date);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
      return res.status(400).json({ error: 'Invalid start or end date' });
    }

    await db.execute(
      `INSERT INTO leave_requests (user_id, type, start_date, end_date, reason, status)
       VALUES (?, ?, ?, ?, ?, 'pending')`,
      [userId, type, start_date, end_date, reason]
    );

    res.status(201).json({ message: 'Leave request submitted' });
  } catch (error) {
    console.error('Create leave request error:', error);
    res.status(500).json({ error: 'Failed to create leave request' });
  }
}

export async function getNotifications(req, res) {
  try {
    const userId = parseInt(req.params.id, 10);
    if (!isSelfOrAdmin(req.user, userId)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const [rows] = await db.execute(
      `SELECT id, message, is_read, created_at
       FROM notifications
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT 25`,
      [userId]
    );

    res.json({ notifications: rows });
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
}

export async function updateEmployeeProfile(req, res) {
  try {
    const userId = parseInt(req.params.id, 10);
    if (!isSelfOrAdmin(req.user, userId)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { name, display_name, bio } = req.body;

    if (name) {
      await db.execute('UPDATE employees SET name = ? WHERE id = ?', [name, userId]);
    }

    const [profiles] = await db.execute(
      'SELECT id FROM profiles WHERE user_id = ?',
      [userId]
    );

    if (profiles.length === 0) {
      await db.execute(
        'INSERT INTO profiles (user_id, display_name, bio) VALUES (?, ?, ?)',
        [userId, display_name || null, bio || null]
      );
    } else {
      await db.execute(
        'UPDATE profiles SET display_name = ?, bio = ? WHERE user_id = ?',
        [display_name || null, bio || null, userId]
      );
    }

    res.json({ message: 'Profile updated successfully' });
  } catch (error) {
    console.error('Update employee profile error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
}
