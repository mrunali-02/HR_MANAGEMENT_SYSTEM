// src/controllers/managerController.js
import db from '../db/db.js';

/* ============================
   MANAGER PROFILE
   ============================ */
/* ============================
   MANAGER PROFILE
   ============================ */
export async function getManagerProfile(req, res) {
  try {
    const managerId = parseInt(req.params.id, 10);
    const userId = req.user.id;

    // Only allow viewing own profile or admin
    if (managerId !== userId && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    // 1. Fetch Basic User Details
    const userPromise = db.execute(
      `SELECT e.id, e.email, e.name, e.role, e.department, e.phone, e.joined_on, e.photo_url, e.address, 
              p.display_name, p.bio
       FROM employees e
       LEFT JOIN profiles p ON e.id = p.user_id
       WHERE e.id = ?`,
      [managerId]
    );

    // 2. Fetch Team Members List
    const teamPromise = db.execute(
      `SELECT id, name, email, role, department, photo_url 
       FROM employees 
       WHERE manager_id = ?`,
      [managerId]
    );

    // 3. Fetch Leave Stats (Pending, Approved, Rejected)
    const leaveStatsPromise = db.execute(
      `SELECT 
         SUM(CASE WHEN lr.status = 'pending' THEN 1 ELSE 0 END) as pendingCount,
         SUM(CASE WHEN lr.status = 'approved' THEN 1 ELSE 0 END) as approvedCount,
         SUM(CASE WHEN lr.status = 'rejected' THEN 1 ELSE 0 END) as rejectedCount
       FROM leave_requests lr
       JOIN employees e ON lr.user_id = e.id
       WHERE e.manager_id = ?`,
      [managerId]
    );

    // 4. Fetch Own Work Hours (Current Month)
    const workHoursPromise = db.execute(
      `SELECT 
         SUM(TIMESTAMPDIFF(HOUR, check_in_time, check_out_time)) as monthHours
       FROM attendance
       WHERE user_id = ? 
         AND MONTH(attendance_date) = MONTH(CURRENT_DATE())
         AND YEAR(attendance_date) = YEAR(CURRENT_DATE())`,
      [managerId]
    );

    // 5. Fetch Own Attendance Status (Today)
    const todayStatusPromise = db.execute(
      `SELECT status, check_in_time, check_out_time 
       FROM attendance 
       WHERE user_id = ? AND attendance_date = CURDATE()`,
      [managerId]
    );

    const [[userRows], [teamRows], [[leaveStats]], [[workHours]], [[todayStats]]] = await Promise.all([
      userPromise,
      teamPromise,
      leaveStatsPromise,
      workHoursPromise,
      todayStatusPromise
    ]);

    if (userRows.length === 0) {
      return res.status(404).json({ error: 'Manager not found' });
    }

    const user = userRows[0];

    // Construct Response
    res.json({
      user: {
        ...user,
        reporting_authority: 'HR Admin' // Placeholder or fetch actual
      },
      profile: user.display_name || user.bio ? {
        display_name: user.display_name,
        bio: user.bio
      } : null,
      team: {
        members: teamRows,
        count: teamRows.length
      },
      stats: {
        leaves: {
          pending: leaveStats.pendingCount || 0,
          approved: leaveStats.approvedCount || 0,
          rejected: leaveStats.rejectedCount || 0
        },
        work: {
          month_hours: workHours.monthHours || 0,
          today_status: todayStats ? todayStats.status : 'Not Marked',
          today_check_in: todayStats ? todayStats.check_in_time : null
        }
      }
    });

  } catch (error) {
    console.error('getManagerProfile error:', error);
    res.status(500).json({ error: 'Failed to fetch manager profile' });
  }
}

/* ============================
   TEAM STATS (FOR DASHBOARD)
   ============================ */
export async function getTeamStats(req, res) {
  try {
    const managerId = req.user.id;

    // Get team size from employees
    const [[teamSizeResult]] = await db.execute(
      `SELECT COUNT(*) AS teamSize FROM employees WHERE manager_id = ?`,
      [managerId]
    );

    // Get leave statistics
    const [[leaveStats]] = await db.execute(
      `
      SELECT
        SUM(CASE WHEN lr.status = 'pending' THEN 1 ELSE 0 END) AS pendingLeaves,
        SUM(CASE WHEN lr.status = 'approved' THEN 1 ELSE 0 END) AS approvedLeaves,
        SUM(CASE WHEN lr.status = 'rejected' THEN 1 ELSE 0 END) AS rejectedLeaves,
        COUNT(*) AS totalLeaves
      FROM leave_requests lr
      JOIN employees e ON lr.user_id = e.id
      WHERE e.manager_id = ?
      `,
      [managerId]
    );

    // Calculate average work hours per day
    const [[avgHours]] = await db.execute(
      `
      SELECT 
        AVG(
          TIMESTAMPDIFF(
            HOUR,
            CONCAT(a.attendance_date, ' ', a.check_in_time),
            CONCAT(a.attendance_date, ' ', a.check_out_time)
          )
        ) AS avgHoursPerDay
      FROM attendance a
      JOIN employees e ON a.user_id = e.id
      WHERE e.manager_id = ?
        AND a.check_in_time IS NOT NULL
        AND a.check_out_time IS NOT NULL
        AND a.attendance_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
      `,
      [managerId]
    );

    res.json({
      teamSize: teamSizeResult?.teamSize || 0,
      pendingLeaves: leaveStats?.pendingLeaves || 0,
      approvedLeaves: leaveStats?.approvedLeaves || 0,
      rejectedLeaves: leaveStats?.rejectedLeaves || 0,
      totalLeaves: leaveStats?.totalLeaves || 0,
      avgHoursPerDay: avgHours?.avgHoursPerDay ? parseFloat(avgHours.avgHoursPerDay).toFixed(2) : '0.00'
    });
  } catch (error) {
    console.error('getTeamStats error:', error);
    res.status(500).json({ error: 'Failed to fetch team stats' });
  }
}

/* ============================
   TEAM ATTENDANCE VIEW
   ============================ */
export async function getTeamAttendance(req, res) {
  try {
    const managerId = req.user.id;

    const [rows] = await db.execute(
      `
      SELECT
        a.id,
        a.user_id,
        DATE_FORMAT(a.attendance_date, '%Y-%m-%d') AS date,
        a.status,
        TIME_FORMAT(a.check_in_time, '%H:%i:%s') AS check_in,
        TIME_FORMAT(a.check_out_time, '%H:%i:%s') AS check_out,
        a.created_at,
        e.name  AS employee_name,
        e.email AS employee_email
      FROM attendance a
      JOIN employees e ON a.user_id = e.id
      WHERE e.manager_id = ?
      ORDER BY a.attendance_date DESC, e.name ASC
      `,
      [managerId]
    );

    res.json({ attendance: rows || [] });
  } catch (error) {
    console.error('getTeamAttendance error:', error);
    res.status(500).json({ error: 'Failed to fetch team attendance' });
  }
}

/* ============================
   TEAM WORK HOURS (SUMMARY)
   ============================ */
export async function getTeamWorkHours(req, res) {
  try {
    const managerId = req.user.id;

    const [rows] = await db.execute(
      `
      SELECT
        a.id,
        a.user_id,
        DATE_FORMAT(a.attendance_date, '%Y-%m-%d') AS date,
        e.name AS employee_name,
        e.email AS employee_email,
        -- total hours between check-in and check-out
        COALESCE(
          TIMESTAMPDIFF(
            HOUR,
            CONCAT(a.attendance_date, ' ', a.check_in_time),
            CONCAT(a.attendance_date, ' ', a.check_out_time)
          ),
          0
        ) AS hours,
        -- Overtime: hours > 8
        GREATEST(
          COALESCE(
            TIMESTAMPDIFF(
              HOUR,
              CONCAT(a.attendance_date, ' ', a.check_in_time),
              CONCAT(a.attendance_date, ' ', a.check_out_time)
            ),
            0
          ) - 8,
          0
        ) AS overtime_hours
      FROM attendance a
      JOIN employees e ON a.user_id = e.id
      WHERE e.manager_id = ?
        AND a.check_in_time IS NOT NULL
        AND a.check_out_time IS NOT NULL
      ORDER BY a.attendance_date DESC, e.name ASC
      `,
      [managerId]
    );

    res.json({ workHours: rows || [] });
  } catch (error) {
    console.error('getTeamWorkHours error:', error);
    res.status(500).json({ error: 'Failed to fetch work hours' });
  }
}

/* ============================
   TEAM LEAVE REQUESTS LIST
   ============================ */
export async function getTeamLeaveRequests(req, res) {
  try {
    const managerId = req.user.id;

    const [rows] = await db.execute(
      `
      SELECT
        lr.id,
        lr.user_id,
        lr.type,
        DATE_FORMAT(lr.start_date, '%Y-%m-%d') AS start_date,
        DATE_FORMAT(lr.end_date, '%Y-%m-%d') AS end_date,
        DATEDIFF(lr.end_date, lr.start_date) + 1 AS days,
        lr.reason,
        lr.status,
        lr.created_at,
        lr.reviewed_by,
        e.name  AS employee_name,
        e.email AS employee_email
      FROM leave_requests lr
      JOIN employees e ON lr.user_id = e.id
      WHERE e.manager_id = ?
      ORDER BY lr.created_at DESC
      `,
      [managerId]
    );

    res.json({ requests: rows || [] });
  } catch (error) {
    console.error('getTeamLeaveRequests error:', error);
    res.status(500).json({ error: 'Failed to fetch leave requests' });
  }
}

/* ============================
   APPROVE TEAM LEAVE
   ============================ */
export async function approveTeamLeave(req, res) {
  try {
    const leaveId = req.params.id;
    const managerId = req.user.id;

    const [result] = await db.execute(
      `
      UPDATE leave_requests lr
      JOIN employees e ON lr.user_id = e.id
      SET lr.status = 'approved',
          lr.reviewed_by = ?
      WHERE lr.id = ?
        AND e.manager_id = ?
        AND lr.status = 'pending'
      `,
      [managerId, leaveId, managerId]
    );

    if (result.affectedRows === 0) {
      return res
        .status(404)
        .json({ error: 'Leave not found, not pending, or not in your team' });
    }

    res.json({ message: 'Leave approved' });
  } catch (error) {
    console.error('approveTeamLeave error:', error);
    res.status(500).json({ error: 'Failed to approve leave' });
  }
}

/* ============================
   REJECT TEAM LEAVE
   ============================ */
export async function rejectTeamLeave(req, res) {
  try {
    const leaveId = req.params.id;
    const managerId = req.user.id;

    const [result] = await db.execute(
      `
      UPDATE leave_requests lr
      JOIN employees e ON lr.user_id = e.id
      SET lr.status = 'rejected',
          lr.reviewed_by = ?
      WHERE lr.id = ?
        AND e.manager_id = ?
        AND lr.status = 'pending'
      `,
      [managerId, leaveId, managerId]
    );

    if (result.affectedRows === 0) {
      return res
        .status(404)
        .json({ error: 'Leave not found, not pending, or not in your team' });
    }

    res.json({ message: 'Leave rejected' });
  } catch (error) {
    console.error('rejectTeamLeave error:', error);
    res.status(500).json({ error: 'Failed to reject leave' });
  }
}
