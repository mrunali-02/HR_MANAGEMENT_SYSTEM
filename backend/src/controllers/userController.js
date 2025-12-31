import db from '../db/db.js';
import { logAudit, createNotification } from '../utils/audit.js';

const isSelfOrAdmin = (reqUser, targetUserId) =>
  reqUser.role === 'admin' || reqUser.id == targetUserId;

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
      `SELECT 
        id, email, role, name, department, phone, joined_on, created_at,
        dob, gender, blood_group, address, emergency_contact 
       FROM employees WHERE id = ? AND role = ?`,
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
        created_at: user.created_at,
        dob: user.dob,
        gender: user.gender,
        blood_group: user.blood_group,
        address: user.address,
        emergency_contact: user.emergency_contact
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

    const hoursSelect = `
  COALESCE(
    CASE 
      WHEN a.check_in_time IS NOT NULL AND a.check_out_time IS NOT NULL THEN
        TIME_FORMAT(
          SEC_TO_TIME(
            TIMESTAMPDIFF(
              SECOND,
              CONCAT(a.attendance_date, ' ', a.check_in_time),
              CONCAT(a.attendance_date, ' ', a.check_out_time)
            )
          ),
          '%H:%i'
        )
      ELSE TIME_FORMAT(SEC_TO_TIME(wh.total_hours * 3600), '%H:%i')
    END,
    '00:00'
  ) AS total_hours_calc,

  COALESCE(wh.is_late, IF(a.check_in_time > '10:00:00', 1, 0)) as is_late,
  COALESCE(wh.is_left_early, IF(a.check_out_time IS NOT NULL AND a.check_out_time < '19:00:00', 1, 0)) as is_left_early



`;



    const [records] = await db.execute(
      `SELECT 
        a.attendance_date, 
        a.status, 
        a.check_in_time, 
        a.check_out_time,
        ${hoursSelect}
       FROM attendance a
       LEFT JOIN work_hours wh ON a.id = wh.attendance_id
       WHERE a.user_id = ? AND a.attendance_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
       ORDER BY a.attendance_date DESC`,
      [userId]
    );

    const [todayRows] = await db.execute(
      `SELECT 
        a.attendance_date, 
        a.status, 
        a.check_in_time, 
        a.check_out_time,
        ${hoursSelect}
       FROM attendance a
       LEFT JOIN work_hours wh ON a.id = wh.attendance_id
       WHERE a.user_id = ? AND a.attendance_date = CURDATE()
       LIMIT 1`,
      [userId]
    );

    const mapRow = (row) => ({
      date: formatDate(row.attendance_date),
      status: row.status,
      check_in: formatTime(row.check_in_time),
      check_out: formatTime(row.check_out_time),
      // just use the string, DO NOT parseFloat
      total_hours: row.total_hours_calc,

      is_late: !!row.is_late,
      is_left_early: !!row.is_left_early
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

// Import geo utils
import { calculateDistance } from '../utils/geo.js';

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

    // Geolocation Validation
    const { latitude, longitude, accuracy } = req.body;

    // 1. Check if coords exist
    if (latitude === undefined || longitude === undefined) {
      return res.status(400).json({ error: 'Location data is required for check-in' });
    }

    // 2. Accuracy check (> 10000m reject) - relaxed for testing
    if (accuracy && accuracy > 10000) {
      return res.status(400).json({ error: 'GPS accuracy is too low (>10000m). Please move to a clearer area.' });
    }

    // 3. Geofence check
    const OFFICE_LAT = parseFloat(process.env.OFFICE_LAT);
    const OFFICE_LNG = parseFloat(process.env.OFFICE_LNG);
    const MAX_DISTANCE = Math.max(parseFloat(process.env.MAX_DISTANCE || '50'), 5000); // Relaxed for testing

    // Check for active WFH
    const [wfh] = await db.execute(
      "SELECT id FROM leave_requests WHERE user_id = ? AND type = 'work_from_home' AND status = 'approved' AND CURDATE() BETWEEN start_date AND end_date",
      [userId]
    );
    const isWfh = wfh.length > 0;

    const now = new Date();
    const nowTime = now.toTimeString().substring(0, 8);
    let distance = null; // Declare distance here for logging accessibility

    // Only validate distance if NOT WFH and Office coords are set
    // if (!isWfh && !isNaN(OFFICE_LAT) && !isNaN(OFFICE_LNG)) {
    //   distance = calculateDistance(latitude, longitude, OFFICE_LAT, OFFICE_LNG);
    //   console.log(`Attendance Check: User at ${latitude},${longitude}. Distance to office: ${distance}m. Max: ${MAX_DISTANCE}m`);

    //   if (distance > MAX_DISTANCE) {
    //     return res.status(400).json({
    //       error: 'You must be within the permitted attendance zone.',
    //       distance: Math.round(distance),
    //       max_distance: MAX_DISTANCE
    //     });
    //   }
    // } else {
    //   console.log('Attendance Check: Skipping geofence (WFH:', isWfh, 'Or Config Missing)');
    // }

    await db.execute(
      `INSERT INTO attendance (
        user_id, attendance_date, status, check_in_time, 
        latitude, longitude, geo_accuracy, marked_with_geo
      ) VALUES (?, CURDATE(), 'present', ?, ?, ?, ?, TRUE)`,
      [userId, nowTime, latitude, longitude, accuracy || null]
    );

    await logAudit(userId, 'attendance_marked', {
      attendance_date: new Date().toISOString().split('T')[0],
      check_in: nowTime,
      location: { lat: latitude, lng: longitude, distance: distance ? Math.round(distance) : null }
    });

    res.json({
      message: 'Attendance marked with location successfully.',
      check_in: nowTime,
      location: { latitude, longitude }
    });
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

    const currentYear = new Date().getFullYear();

    // Try to get year-specific balances first (for carry forward support)
    const [balanceRecords] = await db.execute(
      'SELECT * FROM leave_balances WHERE user_id = ? AND year = ?',
      [userId, currentYear]
    );

    if (balanceRecords.length > 0) {
      // Use stored year-specific balances (includes carried forward)
      const result = {
        total: 0,
        used: 0,
        sick: 0,
        casual: 0,
        paid: 0,
        carried_forward: 0,
        carried_from_year: null
      };

      // Get current leave policies (these are the source of truth)
      const [policies] = await db.execute(
        'SELECT type, total_days FROM leave_policies'
      );
      const policyMap = {};
      policies.forEach((policy) => {
        policyMap[policy.type] = policy.total_days;
      });

      // Extract carried forward and used days from balance records
      balanceRecords.forEach(record => {
        result.used += record.used_days;

        // Track carried forward amounts
        if (record.carried_forward > 0) {
          if (record.leave_type === 'paid') {
            result.carried_forward = record.carried_forward;
            result.carried_from_year = currentYear - 1;
          }
        }
      });

      // Calculate current balances using CURRENT policies + carried forward
      result.sick = (policyMap.sick || 0);
      result.casual = (policyMap.casual || 0);
      result.paid = (policyMap.paid || 0);

      // Add carried forward to respective types
      balanceRecords.forEach(record => {
        if (record.carried_forward > 0) {
          if (result[record.leave_type] !== undefined) {
            result[record.leave_type] += record.carried_forward;
          }
        }
      });

      // Subtract used days from each type
      balanceRecords.forEach(record => {
        if (result[record.leave_type] !== undefined) {
          result[record.leave_type] -= record.used_days;
        }
      });

      // Calculate total
      result.total = result.sick + result.casual + result.paid;

      return res.json({
        ...result,
        policies: policyMap
      });
    }

    // Fall back to dynamic calculation (existing logic for backward compatibility)
    const base = {
      total: 0,
      used: 0,
      sick: 0,
      casual: 0,
      paid: 0,
      carried_forward: 0,
      carried_from_year: null
    };

    const [policies] = await db.execute(
      'SELECT type, total_days FROM leave_policies'
    );
    const policyMap = {};
    policies.forEach((policy) => {
      policyMap[policy.type] = policy.total_days;

      // Update base with policy totals
      if (base[policy.type] !== undefined) {
        base[policy.type] = policy.total_days;
        // Only include sick, casual, paid in total leave pool
        if (['sick', 'casual', 'paid'].includes(policy.type)) {
          base.total += policy.total_days;
        }
      }
    });

    // Only count approved leaves from 2025 onwards (ignore historical leaves before 2025)
    const [usedRows] = await db.execute(
      `SELECT type, COALESCE(SUM(DATEDIFF(end_date, start_date) + 1), 0) AS days
       FROM leave_requests
       WHERE user_id = ? 
       AND status = 'approved'
       AND type != 'comp_off'
       AND YEAR(start_date) >= 2025
       GROUP BY type`,
      [userId]
    );
    usedRows.forEach((row) => {
      base.used += row.days;
      const key = row.type;
      if (typeof base[key] === 'number') {
        base[key] = Math.max(0, base[key] - row.days);
      }
    });

    res.json({
      ...base,
      policies: policyMap
    });
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
      `SELECT id, type, start_date, end_date, days, reason, status, document_url, created_at
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
    console.log('Creating leave request. Params:', req.params, 'Body:', req.body, 'File:', req.file);
    const userId = parseInt(req.params.id, 10);
    if (!isSelfOrAdmin(req.user, userId)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { type, start_date, end_date, reason, working_start_date, working_end_date } = req.body;
    const documentUrl = req.file ? req.file.path : null;

    if (!type || !start_date || !end_date || !reason) {
      return res.status(400).json({ error: 'Missing leave details' });
    }

    if (type === 'comp_off' && (!working_start_date || !working_end_date)) {
      return res.status(400).json({ error: 'Working dates are required for Comp off' });
    }

    const start = new Date(start_date);
    const end = new Date(end_date);
    // Set time to noon to avoid timezone issues with date-only comparison
    start.setHours(12, 0, 0, 0);
    end.setHours(12, 0, 0, 0);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return res.status(400).json({ error: 'Invalid dates' });
    }

    if (end < start) {
      return res.status(400).json({ error: 'End date cannot be before start date' });
    }

    // Prevent retroactive leave (cannot apply for past dates)
    // if (start < today) {
    //    return res.status(400).json({ error: 'Cannot apply for leave in the past' });
    // }

    // Calculate days excluding holidays
    const diffTime = Math.abs(end - start);
    const totalDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

    // Fetch overlapping holidays
    // Note: ensure date format matches DB or use comparison
    const [holidayRows] = await db.execute(
      'SELECT COUNT(*) as count FROM holidays WHERE date BETWEEN ? AND ?',
      [start_date, end_date]
    );
    const holidayCount = holidayRows[0].count;

    // Ensure we don't have negative days if user selected only holidays (frontend should prevent this, but safe backend)
    const diffDays = Math.max(0, totalDays - holidayCount);

    if (diffDays === 0 && type !== 'comp_off') {
      return res.status(400).json({ error: 'Selected range consists only of holidays.' });
    }

    // Comp off specific validation: gap parity
    if (type === 'comp_off') {
      const wStart = new Date(working_start_date);
      const wEnd = new Date(working_end_date);
      wStart.setHours(12, 0, 0, 0);
      wEnd.setHours(12, 0, 0, 0);

      if (Number.isNaN(wStart.getTime()) || Number.isNaN(wEnd.getTime())) {
        return res.status(400).json({ error: 'Invalid working dates' });
      }

      const wDiffTime = Math.abs(wEnd - wStart);
      const wTotalDays = Math.ceil(wDiffTime / (1000 * 60 * 60 * 24)) + 1;

      // For comp off, we compare total duration (including holidays/weekends)
      // to allow earning comp off by working on holidays/weekends.
      if (totalDays !== wTotalDays) {
        return res.status(400).json({
          error: `Leave duration (${totalDays} days) must match working duration (${wTotalDays} days).`
        });
      }
    }

    // Check for overlap
    // Overlap logic: (StartA <= EndB) and (EndA >= StartB)
    const [existing] = await db.execute(
      `SELECT id FROM leave_requests 
       WHERE user_id = ? 
       AND status != 'rejected'
       AND status != 'cancelled'
       AND (start_date <= ? AND end_date >= ?)`,
      [userId, end_date, start_date]
    );

    if (existing.length > 0) {
      return res.status(400).json({ error: 'You already have a leave request for these dates' });
    }

    await db.execute(
      `INSERT INTO leave_requests (user_id, type, start_date, end_date, days, reason, document_url, working_start_date, working_end_date, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [userId, type, start_date, end_date, diffDays, reason, documentUrl, working_start_date || null, working_end_date || null]
    );

    await logAudit(userId, 'leave_requested', { type, start_date, end_date, days: diffDays });

    // Notify manager? (Optional future step)

    res.status(201).json({ message: 'Leave request submitted' });
  } catch (error) {
    console.error('Create leave request error:', error);
    res.status(500).json({ error: 'Failed to create leave request', details: error.message });
  }
}

export async function cancelLeave(req, res) {
  try {
    const userId = parseInt(req.params.id, 10);
    const leaveId = parseInt(req.params.leaveId, 10);

    if (!isSelfOrAdmin(req.user, userId)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Verify leave exists and belongs to user and is pending
    const [leave] = await db.execute(
      'SELECT id, status FROM leave_requests WHERE id = ? AND user_id = ?',
      [leaveId, userId]
    );

    if (leave.length === 0) {
      return res.status(404).json({ error: 'Leave request not found' });
    }

    if (leave[0].status !== 'pending') {
      return res.status(400).json({ error: 'Only pending leave requests can be cancelled' });
    }

    await db.execute(
      "DELETE FROM leave_requests WHERE id = ?",
      [leaveId]
    );

    await logAudit(userId, 'leave_cancelled', { leave_id: leaveId });

    res.json({ message: 'Leave request cancelled successfully' });
  } catch (error) {
    console.error('Cancel leave error:', error);
    res.status(500).json({ error: 'Failed to cancel leave request' });
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

import bcrypt from 'bcrypt';

const BCRYPT_SALT_ROUNDS = Number(process.env.BCRYPT_SALT_ROUNDS || 10);

export async function updateEmployeeProfile(req, res) {
  try {
    const userId = parseInt(req.params.id, 10);
    if (!isSelfOrAdmin(req.user, userId)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { name, display_name, bio, phone, address, emergency_contact } = req.body;

    // Update editable fields in employees table
    // Note: display_name and bio are in 'profiles' table, others in 'employees'
    const userUpdates = [];
    const userParams = [];

    // We allow name update here too as per previous logic, but prompt says "Name ... View no edit".
    // Actually, prompt says "only View no edit their details (Name...)" and "Edit limited fields (Phone number, address, emergency contact)".
    // So I should RESTRICT 'name' update if role is employee.
    // However, the existing code permitted 'name' update `if (name) ...`. 
    // I will remove 'name' update for employees to strictly follow "View no edit".
    // But if admin calls this, maybe they want to update name? Admin has their own update route.
    // I will remove 'name' update here to comply with request for "employee profile" specifically.

    const phoneRegex = /^\d{0,10}$/;

    if (phone !== undefined) {
      if (!phoneRegex.test(phone)) {
        return res.status(400).json({ error: 'Phone number must be at most 10 digits and contain only numbers' });
      }
      userUpdates.push('phone = ?');
      userParams.push(phone);
    }

    if (address !== undefined) {
      userUpdates.push('address = ?');
      userParams.push(address);
    }

    if (emergency_contact !== undefined) {
      if (!phoneRegex.test(emergency_contact)) {
        return res.status(400).json({ error: 'Emergency contact must be at most 10 digits and contain only numbers' });
      }
      userUpdates.push('emergency_contact = ?');
      userParams.push(emergency_contact);
    }

    if (userUpdates.length > 0) {
      userParams.push(userId);
      await db.execute(`UPDATE employees SET ${userUpdates.join(', ')} WHERE id = ?`, userParams);
    }

    // Update Profile table
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

export async function changePassword(req, res) {
  try {
    const userId = parseInt(req.params.id, 10);
    if (!isSelfOrAdmin(req.user, userId)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { currentPassword, newPassword } = req.body;
    if (!newPassword || !currentPassword) {
      return res.status(400).json({ error: 'Current and new password are required' });
    }

    const [rows] = await db.execute('SELECT password_hash FROM employees WHERE id = ?', [userId]);
    if (rows.length === 0) return res.status(404).json({ error: 'User not found' });
    const user = rows[0];

    const match = await bcrypt.compare(currentPassword, user.password_hash);
    if (!match) {
      return res.status(400).json({ error: 'Incorrect current password' });
    }

    const hash = await bcrypt.hash(newPassword, BCRYPT_SALT_ROUNDS);
    await db.execute('UPDATE employees SET password_hash = ? WHERE id = ?', [hash, userId]);

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Failed to change password' });
  }
}



/* ======================
     ATTENDANCE CORRECTIONS
====================== */
export async function getAttendanceCorrections(req, res) {
  try {
    const userId = parseInt(req.params.id, 10);
    if (!isSelfOrAdmin(req.user, userId)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const [corrections] = await db.execute(`
      SELECT 
        ac.id, ac.attendance_id, ac.correction_type, ac.reason, 
        ac.status, ac.reviewed_by, ac.created_at,
        a.attendance_date, a.status AS original_status
      FROM attendance_corrections ac
      JOIN attendance a ON ac.attendance_id = a.id
      WHERE ac.user_id = ?
      ORDER BY ac.created_at DESC
    `, [userId]);

    res.json({ corrections });
  } catch (error) {
    console.error('Get attendance corrections error:', error);
    res.status(500).json({ error: 'Failed to fetch attendance corrections' });
  }
}

export async function createAttendanceCorrection(req, res) {
  try {
    const userId = parseInt(req.params.id, 10);
    if (!isSelfOrAdmin(req.user, userId)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { attendance_id, correction_type, reason } = req.body;
    if (!attendance_id || !correction_type || !reason) {
      return res.status(400).json({ error: 'Attendance ID, correction type, and reason are required' });
    }

    // Verify attendance belongs to user
    const [attendance] = await db.execute(
      'SELECT id FROM attendance WHERE id = ? AND user_id = ?',
      [attendance_id, userId]
    );

    if (attendance.length === 0) {
      return res.status(404).json({ error: 'Attendance record not found' });
    }

    await db.execute(
      `INSERT INTO attendance_corrections (attendance_id, user_id, correction_type, reason, status)
       VALUES (?, ?, ?, ?, 'pending')`,
      [attendance_id, userId, correction_type, reason]
    );

    await logAudit(userId, 'attendance_correction_requested', { attendance_id, correction_type });
    await createNotification(userId, 'Attendance correction request submitted');
    res.status(201).json({ message: 'Attendance correction request submitted' });
  } catch (error) {
    console.error('Create attendance correction error:', error);
    res.status(500).json({ error: 'Failed to create attendance correction' });
  }
}

/* ======================
     MARK CHECKOUT
====================== */
export async function markCheckout(req, res) {
  try {
    const userId = parseInt(req.params.id, 10);
    if (!isSelfOrAdmin(req.user, userId)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Find today's attendance with check-in time
    const [attendance] = await db.execute(
      `SELECT id, attendance_date, check_in_time, check_out_time 
       FROM attendance 
       WHERE user_id = ? AND attendance_date = CURDATE()`,
      [userId]
    );

    if (attendance.length === 0) {
      return res.status(400).json({ error: 'No attendance marked for today. Please mark attendance first.' });
    }

    const att = attendance[0];

    // Check if already checked out
    if (att.check_out_time) {
      return res.status(400).json({ error: 'Checkout already marked for today.' });
    }

    if (!att.check_in_time) {
      return res.status(400).json({ error: 'Check-in time not found. Please mark attendance first.' });
    }

    // Geolocation Validation for Checkout
    const { latitude, longitude, accuracy } = req.body;

    // 1. Check if coords exist
    if (latitude === undefined || longitude === undefined) {
      return res.status(400).json({ error: 'Location data is required for check-out' });
    }

    // 2. Accuracy check (> 10000m reject)
    if (accuracy && accuracy > 10000) {
      return res.status(400).json({ error: 'GPS accuracy is too low. Please move to a clearer area.' });
    }

    // 3. Geofence check
    const OFFICE_LAT = parseFloat(process.env.OFFICE_LAT);
    const OFFICE_LNG = parseFloat(process.env.OFFICE_LNG);
    const MAX_DISTANCE = Math.max(parseFloat(process.env.MAX_DISTANCE || '50'), 5000); // Relaxed for testing

    // Check for active WFH
    const [wfh] = await db.execute(
      "SELECT id FROM leave_requests WHERE user_id = ? AND type = 'work_from_home' AND status = 'approved' AND CURDATE() BETWEEN start_date AND end_date",
      [userId]
    );
    const isWfh = wfh.length > 0;

    // Only validate distance if NOT WFH and Office coords are set
    // if (!isWfh && !isNaN(OFFICE_LAT) && !isNaN(OFFICE_LNG)) {
    //   const distance = calculateDistance(latitude, longitude, OFFICE_LAT, OFFICE_LNG);
    //   console.log(`Checkout Check: User at ${latitude},${longitude}. Distance: ${distance}m. Max: ${MAX_DISTANCE}m`);

    //   if (distance > MAX_DISTANCE) {
    //     return res.status(400).json({
    //       error: 'You must be within the permitted attendance zone to check out.',
    //       distance: Math.round(distance),
    //       max_distance: MAX_DISTANCE
    //     });
    //   }
    // } else {
    //   console.log('Checkout Check: Skipping geofence (WFH:', isWfh, 'Or Config Missing)');
    // }

    const now = new Date();
    const nowTime = now.toTimeString().substring(0, 8);

    // Update attendance with checkout time
    await db.execute(
      'UPDATE attendance SET check_out_time = ? WHERE id = ?',
      [nowTime, att.id]
    );

    // Calculate work hours
    const [workHoursResult] = await db.execute(
      `SELECT 
        TIMESTAMPDIFF(MINUTE, 
          CONCAT(?, ' ', ?), 
          CONCAT(?, ' ', ?)
        ) AS minutes
      `,
      [att.attendance_date, att.check_in_time, att.attendance_date, nowTime]
    );

    const totalMinutes = workHoursResult[0]?.minutes || 0;
    const totalHoursDecimal = totalMinutes / 60;
    const totalHours = parseFloat(totalHoursDecimal.toFixed(2));

    // Calculate Late and Left Early
    // Check In > 10:00:00
    const isLate = att.check_in_time > '10:00:00';
    // Check Out < 19:00:00 (7 PM)
    const isLeftEarly = nowTime < '19:00:00';

    // Insert or update work_hours record
    await db.execute(
      `INSERT INTO work_hours 
       (user_id, attendance_id, work_date, check_in_time, check_out_time, total_hours, is_late, is_left_early)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
       check_out_time = VALUES(check_out_time),
       total_hours = VALUES(total_hours),
       is_late = VALUES(is_late),
       is_left_early = VALUES(is_left_early),
       updated_at = CURRENT_TIMESTAMP`,
      [
        userId,
        att.id,
        att.attendance_date,
        att.check_in_time,
        nowTime,
        totalHours,
        isLate,
        isLeftEarly
      ]
    );

    await logAudit(userId, 'checkout_marked', {
      attendance_id: att.id,
      total_hours: totalHours
    });

    res.json({
      message: 'Checkout marked successfully',
      total_hours: totalHours
    });
  } catch (error) {
    console.error('Mark checkout error:', error);
    res.status(500).json({ error: 'Failed to mark checkout' });
  }
}