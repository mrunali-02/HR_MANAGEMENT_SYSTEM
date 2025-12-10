// src/controllers/adminController.js
import db from '../db/db.js';
import { comparePassword, hashPassword } from '../utils/hash.js';
import { generateToken, getExpiryDate } from '../utils/token.js';
import { logAudit, createNotification } from '../utils/audit.js';

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
    const { email, password, name, first_name, middle_name, last_name, role, employee_id, department, phone, joined_on, address, contact_number, status } = req.body;

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

    // Construct full name for backward compatibility
    const fullName = name || `${last_name || ''}, ${first_name || ''} ${middle_name || ''}`.trim().replace(/\s+/g, ' ');

    const [result] = await db.execute(
      `INSERT INTO employees (
        email, password_hash, name, first_name, middle_name, last_name, role, employee_id, department, phone, joined_on, address, contact_number, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [email, hashedPassword, fullName || null, first_name || null, middle_name || null, last_name || null, role, employee_id || null, department || null, phone || null, joined_on || null, address || null, contact_number || null, status || 'active']
    );

    await db.execute('INSERT INTO profiles (user_id, display_name) VALUES (?, ?)', [result.insertId, name || email]);

    // Audit log
    await logAudit(req.user?.id || null, 'employee_added', {
      employee_id: result.insertId,
      email,
      role,
      employee_code: employee_id || null
    });

    res.status(201).json({ id: result.insertId, email, role, name: name || null });

  } catch (error) {
    res.status(500).json({ error: 'Failed to create employee' });
  }
}

export async function getUsers(req, res) {
  try {
    const [users] = await db.execute(`
      SELECT 
        e.id, 
        e.employee_id, 
        e.email, 
        e.name, 
        e.first_name,
        e.middle_name,
        e.last_name,
        e.status, 
        e.role, 
        e.department, 
        e.phone, 
        e.joined_on, 
        e.address, 
        e.contact_number, 
        e.manager_id,
        e.created_at,
        m.name AS manager_name,
        m.email AS manager_email
      FROM employees e
      LEFT JOIN employees m ON e.manager_id = m.id
      ORDER BY e.created_at DESC
    `);

    res.json({ users });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
}

export async function getManagers(req, res) {
  try {
    const [managers] = await db.execute(`
      SELECT id, name, email, role
      FROM employees 
      WHERE role = 'manager'
      ORDER BY name ASC
    `);

    res.json({ managers });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch managers' });
  }
}

export async function assignManager(req, res) {
  try {
    const { employeeId } = req.params;
    const { managerId } = req.body; // Can be null to unassign

    // Verify employee exists
    const [employee] = await db.execute(
      'SELECT id, role FROM employees WHERE id = ?',
      [employeeId]
    );

    if (employee.length === 0) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    // Don't allow assigning manager to admin or hr
    if (['admin', 'hr'].includes(employee[0].role)) {
      return res.status(400).json({ error: 'Cannot assign manager to admin or HR' });
    }

    // If managerId is provided, verify it's a valid manager
    if (managerId) {
      const [manager] = await db.execute(
        'SELECT id, role FROM employees WHERE id = ? AND role = ?',
        [managerId, 'manager']
      );

      if (manager.length === 0) {
        return res.status(404).json({ error: 'Manager not found' });
      }

      // Don't allow assigning manager to themselves
      if (parseInt(employeeId) === parseInt(managerId)) {
        return res.status(400).json({ error: 'Employee cannot be their own manager' });
      }
    }

    // Update manager_id
    await db.execute(
      'UPDATE employees SET manager_id = ? WHERE id = ?',
      [managerId || null, employeeId]
    );

    await logAudit(req.user.id, 'manager_assigned', {
      employee_id: employeeId,
      manager_id: managerId || null
    });

    res.json({ message: 'Manager assigned successfully' });
  } catch (error) {
    console.error('Assign manager error:', error);
    res.status(500).json({ error: 'Failed to assign manager' });
  }
}

export async function updateEmployee(req, res) {
  try {
    const { id } = req.params;
    const { name, first_name, middle_name, last_name, role, department, phone, joined_on, address, contact_number, status } = req.body;

    if (parseInt(id) === req.user.id && role && role !== req.user.role) {
      return res.status(400).json({ error: 'You cannot change your own role' });
    }

    // Construct full name for backward compatibility
    let fullName = name;
    if (!name && (first_name || last_name)) {
      fullName = `${last_name || ''}, ${first_name || ''} ${middle_name || ''}`.trim().replace(/\s+/g, ' ');
    }

    await db.execute(
      `UPDATE employees SET
        name=?, first_name=?, middle_name=?, last_name=?, role=?, department=?, phone=?, joined_on=?, address=?, contact_number=?, status=? 
       WHERE id=?`,
      [fullName || null, first_name || null, middle_name || null, last_name || null, role || null, department || null, phone || null, joined_on || null, address || null, contact_number || null, status || 'active', id]
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

    // Audit log
    await logAudit(req.user?.id || null, 'employee_deleted', { employee_id: parseInt(id, 10) });

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

    await logAudit(req.user.id, 'password_changed', { admin_id: adminId });
    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to change password' });
  }
}

/* ======================
     DEPARTMENTS MANAGEMENT
====================== */
export async function getDepartments(req, res) {
  try {
    const [departments] = await db.execute(
      'SELECT id, name, description, created_at FROM departments ORDER BY name ASC'
    );
    res.json({ departments });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch departments' });
  }
}

export async function createDepartment(req, res) {
  try {
    const { name, description } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Department name is required' });
    }

    const [result] = await db.execute(
      'INSERT INTO departments (name, description) VALUES (?, ?)',
      [name, description || null]
    );

    await logAudit(req.user.id, 'department_created', { department_id: result.insertId, name });
    res.status(201).json({ id: result.insertId, name, description });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'Department name already exists' });
    }
    res.status(500).json({ error: 'Failed to create department' });
  }
}

export async function updateDepartment(req, res) {
  try {
    const { id } = req.params;
    const { name, description } = req.body;

    await db.execute(
      'UPDATE departments SET name = ?, description = ? WHERE id = ?',
      [name, description || null, id]
    );

    await logAudit(req.user.id, 'department_updated', { department_id: id, name });
    res.json({ message: 'Department updated successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update department' });
  }
}

export async function deleteDepartment(req, res) {
  try {
    const { id } = req.params;

    // Check if any employees are using this department
    const [employees] = await db.execute(
      'SELECT COUNT(*) AS count FROM employees WHERE department = (SELECT name FROM departments WHERE id = ?)',
      [id]
    );

    if (employees[0].count > 0) {
      return res.status(400).json({ error: 'Cannot delete department with assigned employees' });
    }

    await db.execute('DELETE FROM departments WHERE id = ?', [id]);
    await logAudit(req.user.id, 'department_deleted', { department_id: id });
    res.json({ message: 'Department deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete department' });
  }
}

/* ======================
     HOLIDAYS MANAGEMENT
====================== */
export async function getHolidays(req, res) {
  try {
    const [holidays] = await db.execute(
      'SELECT id, name, holiday_date, description, created_at FROM holidays ORDER BY holiday_date ASC'
    );
    res.json({ holidays });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch holidays' });
  }
}

export async function createHoliday(req, res) {
  try {
    const { name, holiday_date, description } = req.body;
    if (!name || !holiday_date) {
      return res.status(400).json({ error: 'Holiday name and date are required' });
    }

    const [result] = await db.execute(
      'INSERT INTO holidays (name, holiday_date, description) VALUES (?, ?, ?)',
      [name, holiday_date, description || null]
    );

    await logAudit(req.user.id, 'holiday_created', { holiday_id: result.insertId, name, date: holiday_date });
    await createNotification(null, `New holiday added: ${name} on ${holiday_date}`);
    res.status(201).json({ id: result.insertId, name, holiday_date, description });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'Holiday for this date already exists' });
    }
    res.status(500).json({ error: 'Failed to create holiday' });
  }
}

export async function updateHoliday(req, res) {
  try {
    const { id } = req.params;
    const { name, holiday_date, description } = req.body;

    await db.execute(
      'UPDATE holidays SET name = ?, holiday_date = ?, description = ? WHERE id = ?',
      [name, holiday_date, description || null, id]
    );

    await logAudit(req.user.id, 'holiday_updated', { holiday_id: id, name });
    res.json({ message: 'Holiday updated successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update holiday' });
  }
}

export async function deleteHoliday(req, res) {
  try {
    const { id } = req.params;
    await db.execute('DELETE FROM holidays WHERE id = ?', [id]);
    await logAudit(req.user.id, 'holiday_deleted', { holiday_id: id });
    res.json({ message: 'Holiday deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete holiday' });
  }
}

/* ======================
     LEAVE POLICIES MANAGEMENT
====================== */
export async function getLeavePolicies(req, res) {
  try {
    const [policies] = await db.execute(
      'SELECT id, name, type, total_days, carry_forward, created_at FROM leave_policies ORDER BY type ASC'
    );
    res.json({ policies });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch leave policies' });
  }
}

export async function createLeavePolicy(req, res) {
  try {
    const { name, type, total_days, carry_forward } = req.body;
    if (!name || !type || total_days === undefined) {
      return res.status(400).json({ error: 'Policy name, type, and total_days are required' });
    }

    if (!['sick', 'casual', 'paid', 'emergency'].includes(type)) {
      return res.status(400).json({ error: 'Invalid leave type' });
    }

    const [result] = await db.execute(
      'INSERT INTO leave_policies (name, type, total_days, carry_forward) VALUES (?, ?, ?, ?)',
      [name, type, total_days, carry_forward ? 1 : 0]
    );

    await logAudit(req.user.id, 'leave_policy_created', { policy_id: result.insertId, type, total_days });
    res.status(201).json({ id: result.insertId, name, type, total_days, carry_forward: !!carry_forward });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create leave policy' });
  }
}

export async function updateLeavePolicy(req, res) {
  try {
    const { id } = req.params;
    const { name, type, total_days, carry_forward } = req.body;

    await db.execute(
      'UPDATE leave_policies SET name = ?, type = ?, total_days = ?, carry_forward = ? WHERE id = ?',
      [name, type, total_days, carry_forward ? 1 : 0, id]
    );

    await logAudit(req.user.id, 'leave_policy_updated', { policy_id: id, type });
    res.json({ message: 'Leave policy updated successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update leave policy' });
  }
}

export async function deleteLeavePolicy(req, res) {
  try {
    const { id } = req.params;
    await db.execute('DELETE FROM leave_policies WHERE id = ?', [id]);
    await logAudit(req.user.id, 'leave_policy_deleted', { policy_id: id });
    res.json({ message: 'Leave policy deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete leave policy' });
  }
}

/* ======================
     ATTENDANCE CORRECTIONS MANAGEMENT
====================== */
export async function getAttendanceCorrections(req, res) {
  try {
    const [corrections] = await db.execute(`
      SELECT 
        ac.id, ac.attendance_id, ac.user_id, ac.correction_type, ac.reason, 
        ac.status, ac.reviewed_by, ac.created_at,
        e.name AS employee_name, e.email AS employee_email,
        a.attendance_date, a.status AS original_status
      FROM attendance_corrections ac
      JOIN employees e ON ac.user_id = e.id
      JOIN attendance a ON ac.attendance_id = a.id
      ORDER BY ac.created_at DESC
    `);
    res.json({ corrections });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch attendance corrections' });
  }
}

export async function approveAttendanceCorrection(req, res) {
  try {
    const { id } = req.params;

    // Get correction details
    const [corrections] = await db.execute(
      'SELECT attendance_id, correction_type FROM attendance_corrections WHERE id = ? AND status = ?',
      [id, 'pending']
    );

    if (corrections.length === 0) {
      return res.status(404).json({ error: 'Correction not found or already processed' });
    }

    const correction = corrections[0];

    // Update attendance based on correction type
    if (correction.correction_type === 'status_change') {
      // This would need additional data from request body
      const { new_status } = req.body;
      await db.execute(
        'UPDATE attendance SET status = ? WHERE id = ?',
        [new_status, correction.attendance_id]
      );
    }

    // Update correction status
    await db.execute(
      'UPDATE attendance_corrections SET status = ?, reviewed_by = ? WHERE id = ?',
      ['approved', req.user.id, id]
    );

    await logAudit(req.user.id, 'attendance_correction_approved', { correction_id: id });
    res.json({ message: 'Attendance correction approved' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to approve attendance correction' });
  }
}

export async function rejectAttendanceCorrection(req, res) {
  try {
    const { id } = req.params;
    await db.execute(
      'UPDATE attendance_corrections SET status = ?, reviewed_by = ? WHERE id = ?',
      ['rejected', req.user.id, id]
    );

    await logAudit(req.user.id, 'attendance_correction_rejected', { correction_id: id });
    res.json({ message: 'Attendance correction rejected' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to reject attendance correction' });
  }
}

/* ======================
     OVERTIMES MANAGEMENT
====================== */
export async function getOvertimes(req, res) {
  try {
    const [overtimes] = await db.execute(`
      SELECT 
        o.id, o.user_id, o.work_date, o.hours, o.description, 
        o.status, o.created_at,
        e.name AS employee_name, e.email AS employee_email
      FROM overtimes o
      JOIN employees e ON o.user_id = e.id
      ORDER BY o.created_at DESC
    `);
    res.json({ overtimes });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch overtimes' });
  }
}

export async function approveOvertime(req, res) {
  try {
    const { id } = req.params;
    await db.execute(
      'UPDATE overtimes SET status = ? WHERE id = ?',
      ['approved', id]
    );

    // Get overtime details for notification
    const [overtime] = await db.execute(
      'SELECT user_id, hours, work_date FROM overtimes WHERE id = ?',
      [id]
    );

    if (overtime.length > 0) {
      await createNotification(
        overtime[0].user_id,
        `Your overtime request for ${overtime[0].work_date} (${overtime[0].hours} hours) has been approved`
      );
    }

    await logAudit(req.user.id, 'overtime_approved', { overtime_id: id });
    res.json({ message: 'Overtime approved' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to approve overtime' });
  }
}

export async function rejectOvertime(req, res) {
  try {
    const { id } = req.params;
    await db.execute(
      'UPDATE overtimes SET status = ? WHERE id = ?',
      ['rejected', id]
    );

    await logAudit(req.user.id, 'overtime_rejected', { overtime_id: id });
    res.json({ message: 'Overtime rejected' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to reject overtime' });
  }
}

/* ======================
     AUDIT LOGS
====================== */
export async function getAuditLogs(req, res) {
  try {
    // Get from query string, if present
    const rawLimit = parseInt(req.query.limit, 10);
    const rawOffset = parseInt(req.query.offset, 10);

    // Sanitize values
    let limitNum = Number.isNaN(rawLimit) ? 100 : rawLimit;
    let offsetNum = Number.isNaN(rawOffset) ? 0 : rawOffset;

    // Hard safety limits
    if (limitNum <= 0) limitNum = 100;
    if (limitNum > 500) limitNum = 500;
    if (offsetNum < 0) offsetNum = 0;

    // Build SQL with numbers directly (no ? in LIMIT/OFFSET)
    const [logs] = await db.execute(`
      SELECT 
        al.id,
        al.user_id,
        al.action,
        al.metadata,
        al.created_at,
        e.name  AS user_name,
        e.email AS user_email
      FROM audit_logs al
      LEFT JOIN employees e ON al.user_id = e.id
      ORDER BY al.created_at DESC
      LIMIT ${limitNum} OFFSET ${offsetNum}
    `);

    const [[count]] = await db.execute(
      'SELECT COUNT(*) AS total FROM audit_logs'
    );

    res.json({
      logs,
      total: count.total,
      limit: limitNum,
      offset: offsetNum,
    });
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
}
