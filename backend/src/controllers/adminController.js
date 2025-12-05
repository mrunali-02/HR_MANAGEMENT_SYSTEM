import db from '../db/db.js';
import { comparePassword, hashPassword } from '../utils/hash.js';
import { generateToken, getExpiryDate } from '../utils/token.js';

export async function adminLogin(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    console.log(`Admin login attempt for email: ${email}`);

    // Find admin by email and role
    const [users] = await db.execute(
      'SELECT id, email, password_hash, role, name FROM employees WHERE email = ? AND role = ?',
      [email, 'admin']
    );

    if (users.length === 0) {
      console.log(`Admin not found or wrong role for email: ${email}`);
      // Check if user exists but is not admin
      const [anyUser] = await db.execute(
        'SELECT role FROM employees WHERE email = ?',
        [email]
      );
      if (anyUser.length > 0) {
        console.log(`User exists but role is: ${anyUser[0].role}`);
      }
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = users[0];
    console.log(`Admin user found: ${user.email}`);

    // Verify password
    const isValid = await comparePassword(password, user.password_hash);
    if (!isValid) {
      console.log(`Password mismatch for admin: ${email}`);
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    console.log(`Admin login successful: ${email}`);

    // Generate token
    const token = generateToken();
    const expiresAt = getExpiryDate();

    // Store token in database
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
        name: user.name
      }
    });
  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
}

export async function addEmployee(req, res) {
  try {
    const {
      email,
      password,
      name,
      role,
      employee_id,
      department,
      phone,
      joined_on,
      address,
      contact_number,
    } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    if (!['employee', 'manager', 'hr'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role. Must be employee, manager, or hr' });
    }

    // Check if email already exists
    const [existing] = await db.execute(
      'SELECT id FROM employees WHERE email = ?',
      [email]
    );

    if (existing.length > 0) {
      return res.status(400).json({ error: 'Email already exists' });
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Create employee
    const [result] = await db.execute(
      `INSERT INTO employees (
         email,
         password_hash,
         name,
         role,
         employee_id,
         department,
         phone,
         joined_on,
         address,
         contact_number
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        email,
        passwordHash,
        name || null,
        role,
        employee_id || null,
        department || null,
        phone || null,
        joined_on || null,
        address || null,
        contact_number || null,
      ]
    );

    const userId = result.insertId;

    // Create profile
    await db.execute(
      'INSERT INTO profiles (user_id, display_name) VALUES (?, ?)',
      [userId, name || email]
    );

    res.status(201).json({
      id: userId,
      email,
      role,
      name: name || null
    });
  } catch (error) {
    console.error('Add employee error:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'Email already exists' });
    }
    res.status(500).json({ error: 'Failed to create employee' });
  }
}

export async function getUsers(req, res) {
  try {
    const [users] = await db.execute(
      `SELECT
         id,
         employee_id,
         email,
         name,
         role,
         department,
         phone,
         joined_on,
         address,
         contact_number,
         created_at
       FROM employees
       ORDER BY created_at DESC`
    );

    res.json({ users });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
}

export async function updateEmployee(req, res) {
  try {
    const { id } = req.params;
    const {
      name,
      role,
      department,
      phone,
      joined_on,
      address,
      contact_number,
    } = req.body;

    // prevent changing own role via this endpoint
    if (parseInt(id, 10) === req.user.id && role && role !== req.user.role) {
      return res.status(400).json({ error: 'You cannot change your own role' });
    }

    await db.execute(
      `UPDATE employees
       SET
         name = ?,
         role = ?,
         department = ?,
         phone = ?,
         joined_on = ?,
         address = ?,
         contact_number = ?
       WHERE id = ?`,
      [
        name || null,
        role || null,
        department || null,
        phone || null,
        joined_on || null,
        address || null,
        contact_number || null,
        id,
      ]
    );

    res.json({ message: 'Employee updated successfully' });
  } catch (error) {
    console.error('Update employee error:', error);
    res.status(500).json({ error: 'Failed to update employee' });
  }
}

export async function deleteUser(req, res) {
  try {
    const { id } = req.params;

    if (parseInt(id) === req.user.id) {
      return res.status(400).json({ error: 'Cannot delete yourself' });
    }

    // Delete user tokens first
    await db.execute('DELETE FROM api_tokens WHERE user_id = ?', [id]);
    
    // Delete profile
    await db.execute('DELETE FROM profiles WHERE user_id = ?', [id]);
    
    // Delete employee
    await db.execute('DELETE FROM employees WHERE id = ?', [id]);

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
}

export async function getLeaveRequests(req, res) {
  try {
    const [requests] = await db.execute(
      `SELECT
         lr.id,
         lr.user_id,
         e.name AS employee_name,
         e.email AS employee_email,
         lr.type,
         lr.start_date,
         lr.end_date,
         lr.reason,
         lr.status,
         lr.created_at
       FROM leave_requests lr
       JOIN employees e ON lr.user_id = e.id
       ORDER BY lr.created_at DESC`
    );

    res.json({ requests });
  } catch (error) {
    console.error('Get leave requests error:', error);
    res.status(500).json({ error: 'Failed to fetch leave requests' });
  }
}

export async function approveLeaveRequest(req, res) {
  try {
    const { id } = req.params;
    const adminId = req.user.id;

    // Check if leave request exists
    const [requests] = await db.execute(
      'SELECT id, status FROM leave_requests WHERE id = ?',
      [id]
    );

    if (requests.length === 0) {
      return res.status(404).json({ error: 'Leave request not found' });
    }

    const leaveRequest = requests[0];

    if (leaveRequest.status !== 'pending') {
      return res.status(400).json({ error: `Leave request is already ${leaveRequest.status}` });
    }

    // Update leave request status
    await db.execute(
      'UPDATE leave_requests SET status = ?, reviewed_by = ? WHERE id = ?',
      ['approved', adminId, id]
    );

    res.json({ message: 'Leave request approved successfully' });
  } catch (error) {
    console.error('Approve leave request error:', error);
    res.status(500).json({ error: 'Failed to approve leave request' });
  }
}

export async function rejectLeaveRequest(req, res) {
  try {
    const { id } = req.params;
    const adminId = req.user.id;

    // Check if leave request exists
    const [requests] = await db.execute(
      'SELECT id, status FROM leave_requests WHERE id = ?',
      [id]
    );

    if (requests.length === 0) {
      return res.status(404).json({ error: 'Leave request not found' });
    }

    const leaveRequest = requests[0];

    if (leaveRequest.status !== 'pending') {
      return res.status(400).json({ error: `Leave request is already ${leaveRequest.status}` });
    }

    // Update leave request status
    await db.execute(
      'UPDATE leave_requests SET status = ?, reviewed_by = ? WHERE id = ?',
      ['rejected', adminId, id]
    );

    res.json({ message: 'Leave request rejected successfully' });
  } catch (error) {
    console.error('Reject leave request error:', error);
    res.status(500).json({ error: 'Failed to reject leave request' });
  }
}

