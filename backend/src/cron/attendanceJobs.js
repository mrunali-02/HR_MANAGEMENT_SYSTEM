import cron from 'node-cron';
import db from '../db/db.js';
import { logAudit, createNotification } from '../utils/audit.js';

const formatDate = (dateValue) => {
    if (!dateValue) return null;
    if (typeof dateValue === 'string') return dateValue.substring(0, 10);
    const iso = dateValue.toISOString();
    return iso.substring(0, 10);
};

export const initAttendanceCron = () => {
    // Schedule task to run at 7:00 PM (19:00) every day
    cron.schedule('0 19 * * *', async () => {
        console.log('Running daily absenteeism check...');
        try {
            // 1. Get all active employees
            const [employees] = await db.execute(
                "SELECT id FROM employees WHERE role IN ('employee', 'manager', 'hr')"
            );

            for (const employee of employees) {
                // 2. Check if attendance exists for today
                const [attendance] = await db.execute(
                    'SELECT id FROM attendance WHERE user_id = ? AND attendance_date = CURDATE()',
                    [employee.id]
                );

                if (attendance.length > 0) {
                    continue; // Attendance already marked
                }

                // 3. Check if user is on approved leave today
                const [leaves] = await db.execute(
                    `SELECT id FROM leave_requests 
             WHERE user_id = ? 
             AND status = 'approved' 
             AND CURDATE() BETWEEN start_date AND end_date`,
                    [employee.id]
                );

                if (leaves.length > 0) {
                    continue; // User is on leave
                }

                // 4. Mark as Absent
                console.log(`Marking user ${employee.id} as absent.`);
                const nowTime = new Date().toTimeString().substring(0, 8);
                await db.execute(
                    `INSERT INTO attendance (
                user_id, attendance_date, status, check_in_time, check_out_time
            ) VALUES (?, CURDATE(), 'absent', NULL, NULL)`,
                    [employee.id]
                );

                await logAudit(null, 'auto_absent_marked', {
                    user_id: employee.id,
                    date: new Date().toISOString().split('T')[0],
                    reason: 'No attendance marked and not on leave'
                });
            }
            console.log('Daily absenteeism check completed.');
        } catch (error) {
            console.error('Error running absenteeism check:', error);
        }
    });

    // Schedule auto-checkout at 7:05 PM (19:05) every day
    cron.schedule('5 19 * * *', async () => {
        console.log('Running daily auto-checkout check...');
        try {
            // Find users who checked in but haven't checked out by 7:05 PM
            const [pendingCheckouts] = await db.execute(`
                SELECT a.id, a.user_id, a.attendance_date, a.check_in_time
                FROM attendance a
                LEFT JOIN work_hours wh ON a.id = wh.attendance_id
                WHERE a.attendance_date = CURDATE()
                  AND a.check_in_time IS NOT NULL
                  AND a.check_out_time IS NULL
                  AND a.status IN ('present', 'remote')
            `);

            console.log(`Found ${pendingCheckouts.length} users pending checkout.`);

            for (const record of pendingCheckouts) {
                const checkoutTime = '19:00:00';

                // Update attendance record
                await db.execute(
                    'UPDATE attendance SET check_out_time = ? WHERE id = ?',
                    [checkoutTime, record.id]
                );

                // Calculate hours
                const [hoursResult] = await db.execute(`
                    SELECT 
                        TIMESTAMPDIFF(SECOND, ?, ?) / 3600.0 as total_hours
                `, [
                    record.check_in_time, // passed as string 'HH:mm:ss' works with mysql time diff usually? 
                    // It's safer to concat date if crossing midnight, but here it is same day.
                    // Actually, let's use full datetime string construction in SQL to be safe like in controllers.
                    checkoutTime
                ]);
                // Wait, TIMESTAMPDIFF with '10:00:00' and '19:00:00' works in MySQL if they are times.

                // Re-calculating using safer SQL similar to userController
                const [calc] = await db.execute(`
                    SELECT 
                        TIME_FORMAT(SEC_TO_TIME(TIMESTAMPDIFF(SECOND, CONCAT(?, ' ', ?), CONCAT(?, ' ', ?))), '%H:%i') as duration,
                        TIMESTAMPDIFF(SECOND, CONCAT(?, ' ', ?), CONCAT(?, ' ', ?)) / 3600.0 as hours_decimal
                `, [
                    record.attendance_date, record.check_in_time,
                    record.attendance_date, checkoutTime,
                    record.attendance_date, record.check_in_time,
                    record.attendance_date, checkoutTime
                ]);

                const totalHours = calc[0].hours_decimal || 0;

                // Determine is_late / is_left_early
                // Late check: check_in > 10:00:00
                const [lateCheck] = await db.execute("SELECT ? > '10:00:00' as is_late", [record.check_in_time]);
                const isLate = lateCheck[0].is_late === 1;

                // Left early: checkout < 19:00:00 -> Since we force 19:00:00, this is effectively FALSE always.
                const isLeftEarly = false;

                // Upsert work_hours
                await db.execute(`
                    INSERT INTO work_hours 
                    (user_id, attendance_id, work_date, check_in_time, check_out_time, total_hours, is_late, is_left_early)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    ON DUPLICATE KEY UPDATE
                    check_out_time = VALUES(check_out_time),
                    total_hours = VALUES(total_hours),
                    is_late = VALUES(is_late),
                    is_left_early = VALUES(is_left_early)
                `, [
                    record.user_id,
                    record.id,
                    record.attendance_date,
                    record.check_in_time,
                    checkoutTime,
                    totalHours,
                    isLate,
                    isLeftEarly
                ]);

                await logAudit(null, 'auto_checkout_marked', {
                    user_id: record.user_id,
                    attendance_id: record.id,
                    date: record.attendance_date,
                    checkout_time: checkoutTime,
                    total_hours: totalHours
                });

                console.log(`Auto-checked out user ${record.user_id} at 19:00:00`);
            }
        } catch (error) {
            console.error('Error running auto-checkout:', error);
        }
    });

    // Schedule Team Absence Alerts at 8:00 AM every day
    cron.schedule('0 8 * * *', async () => {
        console.log('Running daily team absence alerts...');
        try {
            // Find all approved leaves active today
            const [leavesToday] = await db.execute(`
                SELECT lr.user_id, lr.type, lr.start_date, lr.end_date, e.name, e.manager_id
                FROM leave_requests lr
                JOIN employees e ON lr.user_id = e.id
                WHERE lr.status = 'approved'
                  AND CURDATE() BETWEEN lr.start_date AND lr.end_date
            `);

            console.log(`Found ${leavesToday.length} leaves starting today.`);

            for (const leave of leavesToday) {
                const { user_id, type, start_date, end_date, name: applicantName, manager_id: applicantManagerId } = leave;

                // Identify Team to notify
                const recipients = new Set();

                // 1. Notify Manager
                if (applicantManagerId) {
                    recipients.add(applicantManagerId);
                }

                // 2. Notify Subordinates (if this person is a manager)
                const [subordinates] = await db.execute(
                    'SELECT id FROM employees WHERE manager_id = ? AND id != ?',
                    [user_id, user_id]
                );
                subordinates.forEach(s => recipients.add(s.id));

                // 3. Notify Colleagues (same manager)
                if (applicantManagerId) {
                    const [colleagues] = await db.execute(
                        'SELECT id FROM employees WHERE manager_id = ? AND id != ?',
                        [applicantManagerId, user_id]
                    );
                    colleagues.forEach(c => recipients.add(c.id));
                }

                const notificationMessage = `Team Alert: ${applicantName} is absent today (until ${formatDate(end_date)}) due to approved ${type} leave.`;

                for (const recipientId of recipients) {
                    await createNotification(recipientId, notificationMessage);
                }
            }
            console.log('Daily team absence alerts completed.');
        } catch (error) {
            console.error('Error running team absence alerts:', error);
        }
    });

    console.log('Attendance cron jobs initialized.');
};
