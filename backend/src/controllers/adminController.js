// src/controllers/adminController.js
import db from '../db/db.js';
import { comparePassword, hashPassword } from '../utils/hash.js';
import { generateToken, getExpiryDate } from '../utils/token.js';

/* ======================
      ADMIN LOGIN
====================== */
export async function adminLogin(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const [users] = await db.execute(
      'SELECT id, email, password_hash, role, name FROM employees WHERE email = ? AND role = ?',
      [email, 'admin']
    );

    if (users.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = users[0];
    const isValid = await comparePassword(password, user.password_hash);

    if (!isValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = generateToken();
    const expiresAt = getExpiryDate();

    await db.execute(
      'INSERT INTO api_tokens (user_id, token, expires_at) VALUES (?, ?, ?)',
      [user.id, token, expiresAt]
    );

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        name: user.name,
      },
    });

  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
}

/* ======================
     ADMIN EMPLOYEE CRUD
====================== */
export async function addEmployee(req, res) {
  try {
    const { email, password, name, role, employee_id, department, phone, joined_on, address, contact_number } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    if (!['employee', 'manager', 'hr'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    const [existing] = await db.execute('SELECT id FROM employees WHERE email = ?', [email]);
    if (existing.length > 0) {
      return res.status(400).json({ error: 'Email already exists' });
    }

    const hashedPassword = await hashPassword(password);

    const [result] = await db.execute(
      `INSERT INTO employees (
        email, password_hash, name, role, employee_id, department, phone, joined_on, address, contact_number
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [email, hashedPassword, name || null, role, employee_id || null, department || null, phone || null, joined_on || null, address || null, contact_number || null]
    );

    await db.execute('INSERT INTO profiles (user_id, display_name) VALUES (?, ?)', [result.insertId, name || email]);

    res.status(201).json({ id: result.insertId, email, role, name: name || null });

  } catch (error) {
    res.status(500).json({ error: 'Failed to create employee' });
  }
}

export async function getUsers(req, res) {
  try {
    const [users] = await db.execute(`
      SELECT id, employee_id, email, name, role, department, phone, joined_on, address, contact_number, created_at 
      FROM employees ORDER BY created_at DESC
    `);

    res.json({ users });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
}

export async function updateEmployee(req, res) {
  try {
    const { id } = req.params;
    const { name, role, department, phone, joined_on, address, contact_number } = req.body;

    if (parseInt(id) === req.user.id && role && role !== req.user.role) {
      return res.status(400).json({ error: 'You cannot change your own role' });
    }

    await db.execute(
      `UPDATE employees SET
        name=?, role=?, department=?, phone=?, joined_on=?, address=?, contact_number=? 
       WHERE id=?`,
      [name || null, role || null, department || null, phone || null, joined_on || null, address || null, contact_number || null, id]
    );

    res.json({ message: 'Employee updated successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update employee' });
  }
}

export async function deleteUser(req, res) {
  try {
    const { id } = req.params;

    if (parseInt(id) === req.user.id) {
      return res.status(400).json({ error: 'Cannot delete yourself' });
    }

    await db.execute('DELETE FROM api_tokens WHERE user_id = ?', [id]);
    await db.execute('DELETE FROM profiles WHERE user_id = ?', [id]);
    await db.execute('DELETE FROM employees WHERE id = ?', [id]);

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete user' });
  }
}

/* ======================
     ADMIN LEAVE CONTROL
====================== */
export async function getLeaveRequests(req, res) {
  try {
    const [requests] = await db.execute(`
      SELECT lr.id, lr.user_id, e.name AS employee_name, e.email AS employee_email,
             lr.type, lr.start_date, lr.end_date, lr.reason, lr.status, lr.created_at
      FROM leave_requests lr
      JOIN employees e ON lr.user_id = e.id
      ORDER BY lr.created_at DESC
    `);

    res.json({ requests });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch leave requests' });
  }
}

export async function approveLeaveRequest(req, res) {
  try {
    await db.execute('UPDATE leave_requests SET status="approved", reviewed_by=? WHERE id=?', [req.user.id, req.params.id]);
    res.json({ message: 'Leave approved' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to approve leave' });
  }
}

export async function rejectLeaveRequest(req, res) {
  try {
    await db.execute('UPDATE leave_requests SET status="rejected", reviewed_by=? WHERE id=?', [req.user.id, req.params.id]);
    res.json({ message: 'Leave rejected' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to reject leave' });
  }
}

/* ======================
     HR ANALYTICS
====================== */
export async function getHrAnalytics(req, res) {
  try {
    const [[summary]] = await db.execute(`
      SELECT
        (SELECT COUNT(*) FROM employees) AS totalEmployees,
        (SELECT COUNT(*) FROM employees WHERE role='manager') AS totalManagers,
        (SELECT COUNT(*) FROM employees WHERE role='hr') AS totalHr,
        (SELECT COUNT(*) FROM employees WHERE role='employee') AS totalRegulars,
        (SELECT COUNT(*) FROM leave_requests WHERE status='approved') AS approvedLeaves,
        (SELECT COUNT(*) FROM leave_requests WHERE status='pending') AS pendingLeaves,
        (SELECT COUNT(*) FROM leave_requests WHERE status='rejected') AS rejectedLeaves
    `);

    const [deptStats] = await db.execute(`
      SELECT department, COUNT(*) AS count FROM employees WHERE department IS NOT NULL GROUP BY department
    `);

    const [leaveDeptStats] = await db.execute(`
      SELECT e.department, COUNT(*) AS leaveCount
      FROM leave_requests lr 
      JOIN employees e ON lr.user_id=e.id 
      GROUP BY e.department
    `);

    res.json({
      summary,
      departmentDistribution: deptStats,
      departmentLeaveDistribution: leaveDeptStats,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch HR analytics' });
  }
}

/* ======================
     ADMIN SETTINGS
====================== */
export async function updateAdminProfile(req, res) {
  try {
    const { name, email } = req.body;
    const adminId = req.user.id;

    await db.execute(
      'UPDATE employees SET name = ?, email = ? WHERE id = ?',
      [name || null, email, adminId]
    );

    res.json({ message: 'Profile updated successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update profile' });
  }
}

export async function changeAdminPassword(req, res) {
  try {
    const { currentPassword, newPassword } = req.body;
    const adminId = req.user.id;

    const [rows] = await db.execute(
      'SELECT password_hash FROM employees WHERE id = ?',
      [adminId]
    );

    const isValid = await comparePassword(currentPassword, rows[0].password_hash);
    if (!isValid) return res.status(400).json({ error: 'Current password incorrect' });

    const newHash = await hashPassword(newPassword);

    await db.execute(
      'UPDATE employees SET password_hash = ? WHERE id = ?',
      [newHash, adminId]
    );

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to change password' });
  }
}
