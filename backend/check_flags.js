
import db from './src/db/db.js';
import dotenv from 'dotenv';
dotenv.config();

async function checkAttendanceFlags() {
    try {
        console.log('--- Check Attendance Flags ---');

        // 1. Get a user
        const [users] = await db.execute("SELECT id FROM employees LIMIT 1");
        const userId = users[0].id;

        // 2. We interact with the CONTROLLER logic here by mimicking it or just running the query directly.
        // Let's copy the query logic from userController roughly to verify syntax.

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

        const query = `SELECT 
            a.attendance_date, 
            a.status, 
            a.check_in_time, 
            a.check_out_time,
            ${hoursSelect}
           FROM attendance a
           LEFT JOIN work_hours wh ON a.id = wh.attendance_id
           WHERE a.user_id = ? AND a.attendance_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
           ORDER BY a.attendance_date DESC`;

        const [rows] = await db.execute(query, [userId]);
        console.log('Query success! Rows:', rows.length);
        if (rows.length > 0) {
            console.log('Sample Row:', JSON.stringify(rows[0], null, 2));
        }

    } catch (err) {
        console.error('Error:', err);
    } finally {
        process.exit();
    }
}

checkAttendanceFlags();
