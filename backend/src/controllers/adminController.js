// src/controllers/adminController.js
import db from '../db/db.js';
import { comparePassword, hashPassword } from '../utils/hash.js';
import { generateToken, getExpiryDate } from '../utils/token.js';
import { logAudit, createNotification } from '../utils/audit.js';
import ExcelJS from 'exceljs';

const formatDate = (dateValue) => {
  if (!dateValue) return null;
  if (typeof dateValue === 'string') return dateValue.substring(0, 10);
  const iso = dateValue.toISOString();
  return iso.substring(0, 10);
};

/* ======================
     DASHBOARD SUMMARY
====================== */
export async function getDashboardSummary(req, res) {
  try {
    const [[counts]] = await db.execute(`
      SELECT
        (SELECT COUNT(*) FROM employees) AS totalEmployees,
        (SELECT COUNT(*) FROM employees WHERE status = 'active') AS activeEmployees,
        (SELECT COUNT(*) FROM leave_requests lr JOIN employees e ON lr.user_id = e.id WHERE lr.status = 'pending' AND (${req.user.role === 'admin' ? '1=1' : "e.role IN ('manager', 'employee')"})) AS pendingLeaveRequests,
        (SELECT COUNT(*) FROM attendance_corrections WHERE status = 'pending') AS pendingAttendanceCorrections,

        (SELECT COUNT(*) FROM employees WHERE role='manager') AS totalManagers,
        (SELECT COUNT(*) FROM employees WHERE role='hr') AS totalHr,
        (SELECT COUNT(*) FROM employees WHERE role='admin') AS totalAdmins,
        (SELECT COUNT(*) FROM employees WHERE status = 'inactive') AS inactiveEmployees
    `);

    const [[{ presentCount = 0 }]] = await db.execute(`
      SELECT COUNT(*) AS presentCount
      FROM attendance
      WHERE attendance_date = CURDATE()
        AND status IN ('present', 'remote')
    `);

    const [[{ leaveToday = 0 }]] = await db.execute(`
      SELECT COUNT(*) AS leaveToday
      FROM leave_requests
      WHERE status = 'approved'
        AND CURDATE() BETWEEN start_date AND end_date
    `);

    // Birthdays in next 7 days
    const [birthdays] = await db.execute(`
      SELECT id, name, dob, photo_url 
      FROM employees 
      WHERE 
        DATE_ADD(dob, INTERVAL YEAR(CURDATE())-YEAR(dob) + IF(DAYOFYEAR(CURDATE()) > DAYOFYEAR(dob),1,0) YEAR) 
        BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 7 DAY)
      ORDER BY DATE_ADD(dob, INTERVAL YEAR(CURDATE())-YEAR(dob) + IF(DAYOFYEAR(CURDATE()) > DAYOFYEAR(dob),1,0) YEAR) ASC
      LIMIT 5
    `);

    const [[{ managerApprovedToday = 0 }]] = await db.execute(`
      SELECT COUNT(*) AS managerApprovedToday
      FROM leave_requests lr
      JOIN employees e ON lr.reviewed_by = e.id
      WHERE lr.status = 'approved'
        AND DATE(lr.created_at) = CURDATE()
        AND e.role = 'manager'
    `);

    const [[{ newLeaveRequestsToday = 0 }]] = await db.execute(`
      SELECT COUNT(*) AS newLeaveRequestsToday
      FROM leave_requests
      WHERE DATE(created_at) = CURDATE()
        AND status = 'pending'
    `);

    const absentToday = Math.max(
      0,
      (counts?.totalEmployees || 0) - (presentCount || 0) - (leaveToday || 0)
    );

    const notifications = [];
    if (counts?.pendingLeaveRequests > 0) notifications.push(`${counts.pendingLeaveRequests} leave requests pending approval`);
    if (counts?.pendingAttendanceCorrections > 0) notifications.push(`${counts.pendingAttendanceCorrections} attendance corrections pending`);


    if (notifications.length === 0) {
      notifications.push('No actions pending');
    }

    res.json({
      totals: {
        totalEmployees: counts?.totalEmployees || 0,
        activeEmployees: counts?.activeEmployees || 0,
        pendingLeaveRequests: counts?.pendingLeaveRequests || 0,
        pendingAttendanceCorrections: counts?.pendingAttendanceCorrections || 0,

        presentToday: presentCount || 0,
        absentToday,
        totalManagers: counts?.totalManagers || 0,
        totalHr: counts?.totalHr || 0,
        totalAdmins: counts?.totalAdmins || 0,
        inactiveEmployees: counts?.inactiveEmployees || 0,
        leavesToday: leaveToday || 0,
      },
      notifications,
      birthdays: birthdays || []
    });
  } catch (error) {
    console.error('Dashboard summary error:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard summary' });
  }
}

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
      'SELECT id, email, password_hash, role, REPLACE(name, \',\', \'\') AS name FROM employees WHERE email = ? AND role = ?',
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
    const { email, password, name, first_name, middle_name, last_name, role, employee_id, department, phone, joined_on, address, status, dob, gender, blood_group, nationality, emergency_contact } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    if (!['employee', 'manager', 'hr'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    if (status && !['active', 'inactive'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const [existing] = await db.execute('SELECT id FROM employees WHERE email = ?', [email]);
    if (existing.length > 0) {
      return res.status(400).json({ error: 'Email already exists' });
    }

    const hashedPassword = await hashPassword(password);

    // Construct full name for backward compatibility
    const fullName = name || `${first_name || ''} ${middle_name || ''} ${last_name || ''}`.trim().replace(/\s+/g, ' ');

    const [result] = await db.execute(
      `INSERT INTO employees (
        email, password_hash, name, first_name, middle_name, last_name, role, employee_id, department, phone, joined_on, address, status, dob, gender, blood_group, nationality, emergency_contact
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        email, hashedPassword, fullName || null, first_name || null, middle_name || null, last_name || null, role, employee_id || null, department || null, phone || null, joined_on || null, address || null, status || 'active',
        dob || null, gender || null, blood_group || null, nationality || null, emergency_contact || null
      ]
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
        REPLACE(e.name, ',', '') AS name, 
        e.first_name,
        e.middle_name,
        e.last_name,
        e.status, 
        e.role, 
        e.department, 
        e.phone, 
        e.joined_on, 
        e.address, 
        e.dob,
        e.gender,
        e.blood_group,
        e.nationality,
        e.emergency_contact,
        e.manager_id,
        e.created_at,
        REPLACE(m.name, ',', '') AS manager_name,
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
      SELECT id, REPLACE(name, ',', '') AS name, email, role
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
    const { name, first_name, middle_name, last_name, role, department, phone, joined_on, address, status, dob, gender, blood_group, nationality, emergency_contact } = req.body;
    console.log('Update Employee Request:', { id, body: req.body });

    if (parseInt(id) === req.user.id && role && role !== req.user.role) {
      return res.status(400).json({ error: 'You cannot change your own role' });
    }

    // Construct full name for backward compatibility
    let fullName = name;
    if (!name && (first_name || last_name)) {
      fullName = `${first_name || ''} ${middle_name || ''} ${last_name || ''}`.trim().replace(/\s+/g, ' ');
    }

    if (status && !['active', 'inactive'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const [updateResult] = await db.execute(
      `UPDATE employees SET
        name=?, first_name=?, middle_name=?, last_name=?, role=?, department=?, phone=?, joined_on=?, address=?, status=?, dob=?, gender=?, blood_group=?, nationality=?, emergency_contact=?
       WHERE id=?`,
      [
        fullName || null, first_name || null, middle_name || null, last_name || null, role || null, department || null, phone || null, joined_on || null, address || null, status || 'active',
        dob || null, gender || null, blood_group || null, nationality || null, emergency_contact || null,
        id
      ]
    );
    console.log('Update Result:', updateResult);

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
      SELECT lr.id, lr.user_id, REPLACE(e.name, ',', '') AS employee_name, e.email AS employee_email, e.role,
      lr.type, lr.start_date, lr.end_date, lr.days, lr.document_url, lr.reason, lr.status, lr.created_at
      FROM leave_requests lr
      JOIN employees e ON lr.user_id = e.id
      ORDER BY (CASE WHEN lr.status = 'pending' THEN 0 ELSE 1 END) ASC, lr.created_at DESC
      `);

    res.json({ requests });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch leave requests' });
  }
}

export async function getLeaveStatistics(req, res) {
  try {
    const currentYear = new Date().getFullYear();

    const [stats] = await db.execute(`
      SELECT 
        type,
      COUNT(*) as count
      FROM leave_requests
      WHERE YEAR(start_date) = ? OR YEAR(end_date) = ?
      GROUP BY type
      `, [currentYear, currentYear]);

    // Initialize counts
    const leaveCounts = {
      paid: 0,
      casual: 0,
      sick: 0,
      emergency: 0
    };

    stats.forEach(stat => {
      if (leaveCounts.hasOwnProperty(stat.type)) {
        leaveCounts[stat.type] = stat.count;
      }
    });

    res.json({
      year: currentYear,
      plannedLeave: leaveCounts.paid,
      casualLeave: leaveCounts.casual,
      sickLeave: leaveCounts.sick,
      emergencyLeave: leaveCounts.emergency
    });
  } catch (error) {
    console.error('Leave statistics error:', error);
    res.status(500).json({ error: 'Failed to fetch leave statistics' });
  }
}

export async function approveLeaveRequest(req, res) {
  try {
    // Check if the user whose leave is being processed is an HR
    const [leaveRequest] = await db.execute(
      `SELECT lr.user_id, lr.type, lr.start_date, lr.end_date, e.role FROM leave_requests lr 
       JOIN employees e ON lr.user_id = e.id 
       WHERE lr.id = ?`,
      [req.params.id]
    );

    if (leaveRequest.length === 0) {
      return res.status(404).json({ error: 'Leave request not found' });
    }

    const { user_id, type, start_date, end_date, role: requesterRole } = leaveRequest[0];

    // If requester is HR (or Admin), ONLY Admin can approve
    if (requesterRole === 'hr' || requesterRole === 'admin') {
      if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Access denied: Only Admins can approve HR/Admin leaves' });
      }
    }

    await db.execute('UPDATE leave_requests SET status="approved", reviewed_by=? WHERE id=?', [req.user.id, req.params.id]);

    // Send Notification
    await createNotification(
      user_id,
      `Your ${type} leave request from ${formatDate(start_date)} to ${formatDate(end_date)} has been approved.`
    );

    // Log audit
    await logAudit(req.user.id, 'leave_approved', {
      leave_id: req.params.id,
      applicant_role: requesterRole
    });

    // Auto-mark attendance if Work From Home
    if (type === 'work_from_home') {
      const start = new Date(start_date);
      const end = new Date(end_date);

      // Loop through dates
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        // Skip weekends? Maybe WFH is allowed on weekends if applied? 
        // User didn't specify, but usually "attendance" implies working days.
        // However, if they requested leave for a date and it was approved, we should mark it.
        // But we have weekend restrictions on applying, so likely won't be weekend.

        const dateStr = d.toISOString().split('T')[0];

        // Insert remote attendance, ignore if exists
        try {
          await db.execute(
            `INSERT IGNORE INTO attendance (user_id, attendance_date, status, check_in_time, check_out_time, created_at)
             VALUES (?, ?, 'remote', '10:00:00', '19:00:00', NOW())`,
            [user_id, dateStr]
          );
          // Also add work_hours entry? 
          // If 'remote', they are working. Let's assume 10-7 (9 hours)
          // But wait, attendance table has status 'remote'. 
          // Does the system calculate hours from attendance or work_hours table?
          // getAttendance uses work_hours JOIN. So we should probably insert into work_hours too.

          // Fetch the ID of the inserted/existing attendance
          const [attRows] = await db.execute('SELECT id FROM attendance WHERE user_id=? AND attendance_date=?', [user_id, dateStr]);
          if (attRows.length > 0) {
            const attId = attRows[0].id;
            await db.execute(
              `INSERT IGNORE INTO work_hours (user_id, attendance_id, work_date, check_in_time, check_out_time, total_hours)
                VALUES (?, ?, ?, '10:00:00', '19:00:00', 9)`,
              [user_id, attId, dateStr]
            );
          }
        } catch (err) {
          console.error(`Failed to auto-mark WFH attendance for ${dateStr}:`, err);
          // Continue loop
        }
      }
    }

    res.json({ message: 'Leave approved' });
  } catch (error) {
    console.error('Approve leave error:', error);
    res.status(500).json({ error: 'Failed to approve leave' });
  }
}

export async function rejectLeaveRequest(req, res) {
  try {
    // Check if the user whose leave is being processed is an HR
    const [leaveRequest] = await db.execute(
      `SELECT lr.user_id, lr.type, e.role FROM leave_requests lr 
       JOIN employees e ON lr.user_id = e.id 
       WHERE lr.id = ?`,
      [req.params.id]
    );

    if (leaveRequest.length === 0) {
      return res.status(404).json({ error: 'Leave request not found' });
    }

    const { user_id, type, role: requesterRole } = leaveRequest[0];

    // If requester is HR (or Admin), ONLY Admin can reject
    if (requesterRole === 'hr' || requesterRole === 'admin') {
      if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Access denied: Only Admins can reject HR/Admin leaves' });
      }
    }

    await db.execute('UPDATE leave_requests SET status="rejected", reviewed_by=? WHERE id=?', [req.user.id, req.params.id]);

    // Send Notification
    await createNotification(
      user_id,
      `Your ${type} leave request has been rejected.`
    );

    // Log audit
    await logAudit(req.user.id, 'leave_rejected', {
      leave_id: req.params.id,
      applicant_role: requesterRole
    });
    res.json({ message: 'Leave rejected' });
  } catch (error) {
    console.error('Reject leave error:', error);
    res.status(500).json({ error: 'Failed to reject leave' });
  }
}

export async function createApprovedLeave(req, res) {
  try {
    const { employeeId } = req.params;
    const { start_date, end_date, reason } = req.body;

    if (!start_date || !end_date || !reason) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Insert as approved immediately
    // reviewed_by = req.user.id (the HR who added it)
    await db.execute(
      `INSERT INTO leave_requests (user_id, type, start_date, end_date, reason, status, reviewed_by)
       VALUES (?, 'sick', ?, ?, ?, 'approved', ?)`,
      [employeeId, start_date, end_date, reason, req.user.id]
    );

    // Notification
    await createNotification(
      employeeId,
      `HR has added a Sick Leave record for you from ${start_date} to ${end_date}.`
    );

    // Audit log
    await logAudit(req.user.id, 'leave_created_admin', {
      employee_id: employeeId,
      type: 'sick',
      status: 'approved'
    });

    res.json({ message: 'Sick leave added and approved successfully' });
  } catch (error) {
    console.error('Create approved leave error:', error);
    res.status(500).json({ error: 'Failed to create sick leave' });
  }
}

/* ======================
     HR ANALYTICS
====================== */
export async function getHrAnalytics(req, res) {
  try {
    const { startDate, endDate } = req.query;
    const end = endDate || new Date().toISOString().split('T')[0];
    const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const [[summary]] = await db.execute(`
      SELECT
        (SELECT COUNT(*) FROM employees) AS totalEmployees,
        (SELECT COUNT(*) FROM employees WHERE role = 'manager') AS totalManagers,
        (SELECT COUNT(*) FROM employees WHERE role = 'hr') AS totalHr,
        (SELECT COUNT(*) FROM employees WHERE role = 'employee') AS totalRegulars,
        (SELECT COUNT(*) FROM leave_requests WHERE status = 'approved' AND start_date BETWEEN ? AND ?) AS approvedLeaves,
        (SELECT COUNT(*) FROM leave_requests WHERE status = 'pending' AND start_date BETWEEN ? AND ?) AS pendingLeaves,
        (SELECT COUNT(*) FROM leave_requests WHERE status = 'rejected' AND start_date BETWEEN ? AND ?) AS rejectedLeaves,
        (SELECT COUNT(*) FROM leave_requests WHERE status = 'pending') AS totalPendingLeaves
    `, [start, end, start, end, start, end]);

    const [deptStats] = await db.execute(`
      SELECT department, COUNT(*) AS count FROM employees WHERE department IS NOT NULL GROUP BY department
    `);

    const [leaveDeptStats] = await db.execute(`
      SELECT e.department, COUNT(*) AS leaveCount
      FROM leave_requests lr 
      JOIN employees e ON lr.user_id = e.id 
      WHERE lr.start_date BETWEEN ? AND ?
      GROUP BY e.department
    `, [start, end]);

    res.json({
      summary,
      departmentDistribution: deptStats,
      departmentLeaveDistribution: leaveDeptStats,
    });
  } catch (error) {
    console.error(error);
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
        ADMIN NOTES
====================== */
export async function getAdminNotes(req, res) {
  try {
    const [rows] = await db.execute(
      `SELECT id, user_id, content, created_at 
       FROM admin_notes 
       ORDER BY created_at DESC`
    );
    res.json({ notes: rows });
  } catch (error) {
    console.error('Get admin notes error:', error);
    res.status(500).json({ error: 'Failed to fetch notes' });
  }
}

export async function createAdminNote(req, res) {
  try {
    const content = (req.body.content || '').trim();
    if (!content) {
      return res.status(400).json({ error: 'Note content is required' });
    }

    const [result] = await db.execute(
      'INSERT INTO admin_notes (user_id, content) VALUES (?, ?)',
      [req.user.id, content]
    );

    await logAudit(req.user.id, 'admin_note_created', { note_id: result.insertId });

    res.status(201).json({
      id: result.insertId,
      user_id: req.user.id,
      content,
      created_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Create admin note error:', error);
    res.status(500).json({ error: 'Failed to create note' });
  }
}

export async function deleteAdminNote(req, res) {
  try {
    const { id } = req.params;
    await db.execute('DELETE FROM admin_notes WHERE id = ?', [id]);
    await logAudit(req.user.id, 'admin_note_deleted', { note_id: parseInt(id, 10) });
    res.json({ message: 'Note deleted' });
  } catch (error) {
    console.error('Delete admin note error:', error);
    res.status(500).json({ error: 'Failed to delete note' });
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
      'SELECT id, name, date, description, created_at FROM holidays ORDER BY date ASC'
    );
    res.json({ holidays });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch holidays' });
  }
}

export async function createHoliday(req, res) {
  try {
    const { name, date, description } = req.body;
    if (!name || !date) {
      return res.status(400).json({ error: 'Holiday name and date are required' });
    }

    const [result] = await db.execute(
      'INSERT INTO holidays (name, holiday_date, description) VALUES (?, ?, ?)',
      [name, date, description || null]
    );

    await logAudit(req.user.id, 'holiday_created', { holiday_id: result.insertId, name, date: date });
    await createNotification(null, `New holiday added: ${name} on ${date} `);
    res.status(201).json({ id: result.insertId, name, date, description });
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
    const { name, date, description } = req.body;

    await db.execute(
      'UPDATE holidays SET name = ?, date = ?, description = ? WHERE id = ?',
      [name, date, description || null, id]
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
      REPLACE(e.name, ',', '') AS employee_name, e.email AS employee_email,
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
      'SELECT attendance_id, correction_type, user_id FROM attendance_corrections WHERE id = ? AND status = ?',
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
      if (new_status) {
        await db.execute(
          'UPDATE attendance SET status = ? WHERE id = ?',
          [new_status, correction.attendance_id]
        );
      }
    }

    // Update correction status
    await db.execute(
      'UPDATE attendance_corrections SET status = ?, reviewed_by = ? WHERE id = ?',
      ['approved', req.user.id, id]
    );

    await createNotification(
      correction.user_id,
      'Your attendance correction request has been approved.'
    );

    await logAudit(req.user.id, 'attendance_correction_approved', { correction_id: id });
    res.json({ message: 'Attendance correction approved' });
  } catch (error) {
    console.error('Approve correction error:', error);
    res.status(500).json({ error: 'Failed to approve attendance correction' });
  }
}

export async function rejectAttendanceCorrection(req, res) {
  try {
    const { id } = req.params;

    // Get user_id for notification
    const [corrections] = await db.execute(
      'SELECT user_id FROM attendance_corrections WHERE id = ?',
      [id]
    );

    await db.execute(
      'UPDATE attendance_corrections SET status = ?, reviewed_by = ? WHERE id = ?',
      ['rejected', req.user.id, id]
    );

    if (corrections.length > 0) {
      await createNotification(
        corrections[0].user_id,
        'Your attendance correction request has been rejected.'
      );
    }

    await logAudit(req.user.id, 'attendance_correction_rejected', { correction_id: id });
    res.json({ message: 'Attendance correction rejected' });
  } catch (error) {
    console.error('Reject correction error:', error);
    res.status(500).json({ error: 'Failed to reject attendance correction' });
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

    // Sorting
    const { sortBy, sortOrder } = req.query;
    let orderByClause = 'ORDER BY al.created_at DESC';

    // Whitelist allowed columns for sorting
    const allowedSortColumns = {
      'time': 'al.created_at',
      'timestamp': 'al.created_at',
      'user': 'user_email', // or user_name
      'activity': 'al.action',
      'action': 'al.action',
      'created_at': 'al.created_at'
    };

    if (sortBy && allowedSortColumns[sortBy]) {
      const direction = (sortOrder || 'DESC').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
      orderByClause = `ORDER BY ${allowedSortColumns[sortBy]} ${direction} `;
    }

    // Search
    const { search } = req.query;
    let whereClause = '';
    const queryParams = [];
    const countParams = [];

    if (search) {
      whereClause = `
    WHERE(
      e.name LIKE ?
      OR e.email LIKE ?
      OR al.action LIKE ?
        )
      `;
      const searchTerm = `%${search}%`;
      queryParams.push(searchTerm, searchTerm, searchTerm);
      countParams.push(searchTerm, searchTerm, searchTerm);
    }

    // Build SQL with numbers directly (no ? in LIMIT/OFFSET)
    const [logs] = await db.execute(`
      SELECT 
        al.id, al.user_id, al.action, al.metadata, al.created_at,
        REPLACE(e.name, ',', '') AS user_name, e.email AS user_email
      FROM audit_logs al
      LEFT JOIN employees e ON al.user_id = e.id
      ${whereClause}
      ${orderByClause}
      LIMIT ${limitNum} OFFSET ${offsetNum}
    `, queryParams);

    const [[count]] = await db.execute(
      `SELECT COUNT(*) AS total 
       FROM audit_logs al 
       LEFT JOIN employees e ON al.user_id = e.id
       ${whereClause} `,
      countParams
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

export async function exportAuditLogs(req, res) {
  try {
    const { startDate, endDate } = req.query;

    const end = endDate || new Date().toISOString().split('T')[0];
    const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    // Build query similar to getAuditLogs but without pagination and simple selection
    const [rows] = await db.execute(`
      SELECT 
        al.created_at as time,
        REPLACE(e.name, ',', '') as user_name,
        e.email as user_email,
        al.action,
        al.metadata
      FROM audit_logs al
      LEFT JOIN employees e ON al.user_id = e.id
      WHERE DATE(al.created_at) BETWEEN ? AND ?
      ORDER BY al.created_at ASC
    `, [start, end]);

    // Format metadata to be more readable if it's a JSON string
    const formattedRows = rows.map(row => ({
      ...row,
      metadata: typeof row.metadata === 'object' ? JSON.stringify(row.metadata) : row.metadata
    }));

    res.json(formattedRows);
  } catch (error) {
    console.error('Export audit logs error:', error);
    res.status(500).json({ error: 'Failed to export audit logs' });
  }
}

/* ======================
     REPORTS (CHARTS)
====================== */
export async function getAttendanceReport(req, res) {
  try {
    const { startDate, endDate, department } = req.query;

    // Default to last 30 days if not provided
    const end = endDate || new Date().toISOString().split('T')[0];
    const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const departmentFilter = department ? 'AND e.department = ?' : '';
    const params = department ? [start, end, department] : [start, end];

    const [stats] = await db.execute(`
    SELECT
    DATE_FORMAT(a.attendance_date, '%Y-%m-%d') as date,
      SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) as present,
      SUM(CASE WHEN a.status = 'absent' THEN 1 ELSE 0 END) as absent,
      SUM(CASE WHEN a.status = 'half_day' THEN 1 ELSE 0 END) as half_day,
      SUM(CASE WHEN a.status = 'late' THEN 1 ELSE 0 END) as late,
      COUNT(*) as total_records
      FROM attendance a
      JOIN employees e ON a.user_id = e.id
      WHERE a.attendance_date BETWEEN ? AND ?
      ${departmentFilter}
      GROUP BY date
      ORDER BY date ASC
      `, params);

    res.json({ stats });
  } catch (error) {
    console.error('Attendance report error:', error);
    res.status(500).json({ error: 'Failed to fetch attendance report' });
  }
}

export async function getLeaveReport(req, res) {
  try {
    const { startDate, endDate } = req.query;

    const end = endDate || new Date().toISOString().split('T')[0];
    const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    // Grouping by start_date for the chart (Trend of leave applications)
    const [stats] = await db.execute(`
    SELECT
    DATE_FORMAT(start_date, '%Y-%m-%d') as date,
      type,
      COUNT(*) as count
      FROM leave_requests
      WHERE start_date BETWEEN ? AND ?
      GROUP BY date, type
      ORDER BY date ASC
      `, [start, end]);

    // Also get breakdown by status for the period
    const [summary] = await db.execute(`
      SELECT type, status, COUNT(*) as count
      FROM leave_requests
      WHERE start_date BETWEEN ? AND ?
      GROUP BY type, status
        `, [start, end]);

    res.json({ stats, summary });
  } catch (error) {
    console.error('Leave report error:', error);
    res.status(500).json({ error: 'Failed to fetch leave report' });
  }
}

/* ======================
     DATA EXPORT for ADMIN
====================== */
export async function exportAttendance(req, res) {
  try {
    const query = `
      SELECT 
        a.id, a.user_id, e.name as employee_name, e.department,
        a.attendance_date as date, a.status, 
        a.check_in_time, a.check_out_time, 
        TIME_FORMAT(
          SEC_TO_TIME(
            TIMESTAMPDIFF(
              SECOND,
              CONCAT(a.attendance_date, ' ', a.check_in_time),
              CONCAT(a.attendance_date, ' ', a.check_out_time)
            )
          ),
          '%H:%i'
        ) as total_hours
      FROM attendance a
      JOIN employees e ON a.user_id = e.id
      ORDER BY a.attendance_date DESC
    `;
    const [rows] = await db.execute(query);
    res.json(rows);
  } catch (error) {
    console.error('Export attendance error:', error);
    res.status(500).json({ error: 'Failed to export attendance' });
  }
}

export async function exportLeaves(req, res) {
  try {
    const query = `
      SELECT 
        lr.id, lr.user_id, e.name as employee_name, e.department,
        lr.type, lr.start_date, lr.end_date, 
        (DATEDIFF(lr.end_date, lr.start_date) + 1) as days,
        lr.reason, lr.status, lr.created_at
      FROM leave_requests lr
      JOIN employees e ON lr.user_id = e.id
      ORDER BY lr.created_at DESC
    `;
    const [rows] = await db.execute(query);
    res.json(rows);
  } catch (error) {
    console.error('Export leaves error:', error);
    res.status(500).json({ error: 'Failed to export leaves' });
  }
}

export async function exportEmployees(req, res) {
  try {
    const query = `
      SELECT 
        id, name, email, role, department, 
        phone, joined_on, status, 
        dob, gender, blood_group, address
      FROM employees 
      ORDER BY created_at DESC
    `;
    const [rows] = await db.execute(query);
    res.json(rows);
  } catch (error) {
    console.error('Export employees error:', error);
    res.status(500).json({ error: 'Failed to export employees' });
  }
}

export async function exportWorkHoursExcel(req, res) {
  try {
    const search = req.query.search || '';
    const { startDate, endDate } = req.query;

    let whereClause = 'WHERE 1=1';
    const params = [];

    if (search) {
      whereClause += ` AND (e.name LIKE ? OR e.email LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`);
    }

    if (startDate) {
      whereClause += ` AND a.attendance_date >= ?`;
      params.push(startDate);
    }

    if (endDate) {
      whereClause += ` AND a.attendance_date <= ?`;
      params.push(endDate);
    }

    const query = `
      SELECT 
        DATE_FORMAT(a.attendance_date, '%Y-%m-%d') as date,
        e.name as employee_name, 
        e.email as employee_email, 
        e.department,
        a.check_in_time, 
        a.check_out_time, 
        COALESCE(wh.total_hours, 0) as total_hours,
        wh.is_late,
        wh.is_left_early,
        a.status
      FROM attendance a
      JOIN employees e ON a.user_id = e.id
      LEFT JOIN work_hours wh ON a.id = wh.attendance_id
      ${whereClause}
      ORDER BY a.attendance_date DESC, e.name ASC
    `;

    const [rows] = await db.execute(query, params);

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Work Hours');

    worksheet.columns = [
      { header: 'Date', key: 'date', width: 15 },
      { header: 'Employee Name', key: 'employee_name', width: 25 },
      { header: 'Email', key: 'employee_email', width: 30 },
      { header: 'Department', key: 'department', width: 15 },
      { header: 'Check In', key: 'check_in_time', width: 12 },
      { header: 'Check Out', key: 'check_out_time', width: 12 },
      { header: 'Total Hours', key: 'total_hours', width: 12 },
      { header: 'Status', key: 'status', width: 12 },
      { header: 'Is Late', key: 'is_late', width: 10 },
      { header: 'Left Early', key: 'is_left_early', width: 10 }
    ];

    // Style header
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' }
    };

    rows.forEach(row => {
      worksheet.addRow({
        date: row.date,
        employee_name: row.employee_name,
        employee_email: row.employee_email,
        department: row.department,
        check_in_time: row.check_in_time,
        check_out_time: row.check_out_time,
        total_hours: row.total_hours,
        status: row.status,
        is_late: row.is_late ? 'Yes' : 'No',
        is_left_early: row.is_left_early ? 'Yes' : 'No'
      });
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=Work_Hours_Report.xlsx');

    await workbook.xlsx.write(res);
    res.end();

  } catch (error) {
    console.error('Export work hours excel error:', error);
    res.status(500).json({ error: 'Failed to export work hours excel' });
  }
}

export async function getWorkHoursStats(req, res) {
  try {
    const { startDate, endDate } = req.query;
    const end = endDate || new Date().toISOString().split('T')[0];
    const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    // Average work hours per department
    const [deptHours] = await db.execute(`
      SELECT 
        e.department, 
        AVG(
          TIMESTAMPDIFF(MINUTE, 
            CONCAT(a.attendance_date, ' ', a.check_in_time), 
            CONCAT(a.attendance_date, ' ', a.check_out_time)
          ) / 60.0
        ) as avg_hours
      FROM attendance a
      JOIN employees e ON a.user_id = e.id
      WHERE a.check_out_time IS NOT NULL 
        AND a.attendance_date BETWEEN ? AND ?
        AND e.department IS NOT NULL
      GROUP BY e.department
    `, [start, end]);

    // Daily average work hours (Trend)
    const [dailyTrend] = await db.execute(`
      SELECT 
        DATE_FORMAT(attendance_date, '%Y-%m-%d') as date,
        AVG(
          TIMESTAMPDIFF(MINUTE, 
            CONCAT(attendance_date, ' ', check_in_time), 
            CONCAT(attendance_date, ' ', check_out_time)
          ) / 60.0
        ) as avg_hours
      FROM attendance a
      WHERE check_out_time IS NOT NULL 
        AND attendance_date BETWEEN ? AND ?
      GROUP BY date
      ORDER BY date ASC
    `, [start, end]);

    res.json({ departmentHours: deptHours, dailyTrend });
  } catch (error) {
    console.error('Work hours stats error:', error);
    res.status(500).json({ error: 'Failed to fetch work hours stats' });
  }
}

export async function getEmployeeRoleStats(req, res) {
  try {
    const [stats] = await db.execute(`
      SELECT role, COUNT(*) as count
      FROM employees
      GROUP BY role
      `);
    res.json({ stats });
  } catch (error) {
    console.error('Role stats error:', error);
    res.status(500).json({ error: 'Failed to fetch role stats' });
  }
}

export async function getAllAttendanceRecords(req, res) {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const search = req.query.search || '';
    const { startDate, endDate, department } = req.query;

    const offset = (page - 1) * limit;

    let whereClause = 'WHERE 1=1';
    const params = [];

    if (search) {
      whereClause += ` AND (e.name LIKE ? OR e.email LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`);
    }

    if (startDate) {
      whereClause += ` AND a.attendance_date >= ?`;
      params.push(startDate);
    }

    if (endDate) {
      whereClause += ` AND a.attendance_date <= ?`;
      params.push(endDate);
    }

    if (department) {
      whereClause += ` AND e.department = ?`;
      params.push(department);
    }

    // Main query
    const query = `
      SELECT 
        a.id, a.user_id, e.name as employee_name, e.email as employee_email, e.department,
        a.attendance_date as date, a.status, 
        a.check_in_time, a.check_out_time, 
        COALESCE(
          IF(a.check_out_time IS NOT NULL,
            TIME_FORMAT(
              SEC_TO_TIME(
                TIMESTAMPDIFF(
                  SECOND,
                  CONCAT(a.attendance_date, ' ', a.check_in_time),
                  CONCAT(a.attendance_date, ' ', a.check_out_time)
                )
              ),
              '%H:%i'
            ),
            NULL
          ),
          TIME_FORMAT(SEC_TO_TIME(wh.total_hours * 3600), '%H:%i'),
          '00:00'
        ) as total_hours,
        wh.is_late,
        wh.is_left_early
      FROM attendance a
      JOIN employees e ON a.user_id = e.id
      LEFT JOIN work_hours wh ON a.id = wh.attendance_id
      ${whereClause}
      ORDER BY a.attendance_date DESC, a.check_in_time DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    // Count query
    const countQuery = `
      SELECT COUNT(*) as total
      FROM attendance a
      JOIN employees e ON a.user_id = e.id
      ${whereClause}
    `;

    const [rows] = await db.execute(query, params);
    const [countResult] = await db.execute(countQuery, params);

    res.json({
      records: rows,
      total: countResult[0].total,
      page: parseInt(page),
      limit: parseInt(limit)
    });

  } catch (error) {
    console.error('Get all attendance records error:', error);
    res.status(500).json({ error: 'Failed to fetch attendance records' });
  }
}

export async function getCalendarSummary(req, res) {
  try {
    const { month, year } = req.query;
    if (!month || !year) {
      return res.status(400).json({ error: 'Month and year are required' });
    }

    // Prepare date range
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = `${year}-${String(month).padStart(2, '0')}-${lastDay}`;

    // 1. Fetch Attendance (Present, Absent, Late - assuming 'absent' is explicitly marked or inferred for daily checks)
    // Note: 'absent' records might not exist if system doesn't auto-create them. We only fetch what is recorded.
    const [attendanceRows] = await db.execute(`
      SELECT a.attendance_date, a.status, a.user_id, e.name
      FROM attendance a
      JOIN employees e ON a.user_id = e.id
      WHERE a.attendance_date BETWEEN ? AND ?
    `, [startDate, endDate]);

    // 2. Fetch Approved Leaves
    // Leaves can span multiple days, so we check overlap with the month
    const [leaveRows] = await db.execute(`
      SELECT lr.start_date, lr.end_date, lr.type, lr.user_id, e.name
      FROM leave_requests lr
      JOIN employees e ON lr.user_id = e.id
      WHERE lr.status = 'approved'
      AND (
        (lr.start_date BETWEEN ? AND ?) OR
        (lr.end_date BETWEEN ? AND ?) OR
        (lr.start_date <= ? AND lr.end_date >= ?)
      )
    `, [startDate, endDate, startDate, endDate, startDate, endDate]);

    // 3. Process into Daily Map
    const summary = {};

    // Initialize all days in month
    for (let d = 1; d <= lastDay; d++) {
      const dayStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      summary[dayStr] = { present: [], absent: [], leave: [], holiday: null };
    }

    // Fill Attendance
    attendanceRows.forEach(row => {
      const dateStr = row.attendance_date instanceof Date
        ? row.attendance_date.toISOString().split('T')[0]
        : row.attendance_date;

      if (summary[dateStr]) {
        if (row.status === 'present' || row.status === 'late' || row.status === 'half_day' || row.status === 'remote') {
          summary[dateStr].present.push(row.name);
        } else if (row.status === 'absent') {
          summary[dateStr].absent.push(row.name);
        }
      }
    });

    // Fill Leaves (expand ranges)
    leaveRows.forEach(row => {
      if (row.type === 'work_from_home') return; // Treat WFH as present (handled in attendance), not leave

      let current = new Date(row.start_date);
      const end = new Date(row.end_date);
      const limitStart = new Date(startDate);
      const limitEnd = new Date(endDate);

      // Clamp start
      if (current < limitStart) current = limitStart;

      while (current <= end && current <= limitEnd) {
        const dateStr = current.toISOString().split('T')[0];
        if (summary[dateStr]) {
          summary[dateStr].leave.push({ name: row.name, type: row.type });
        }
        current.setDate(current.getDate() + 1);
      }
    });

    res.json(summary);
  } catch (error) {
    console.error('Get calendar summary error:', error);
    res.status(500).json({ error: 'Failed to fetch calendar summary' });
  }
}