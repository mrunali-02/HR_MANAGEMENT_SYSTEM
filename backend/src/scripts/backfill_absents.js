import db from '../db/db.js';
import { logAudit } from '../utils/audit.js';

async function backfillAbsents() {
    try {
        const PROJECT_START_DATE = new Date('2025-12-01');
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        yesterday.setHours(23, 59, 59, 999);

        console.log(`Starting backfill from ${PROJECT_START_DATE.toISOString()} to ${yesterday.toISOString()}`);

        // Get all employees, managers, and HR
        const [employees] = await db.execute("SELECT id, name, joined_on FROM employees WHERE role IN ('employee', 'manager', 'hr')");

        let totalMarked = 0;

        for (const emp of employees) {
            const joinDate = new Date(emp.joined_on);

            // Start from whichever is later: Project Start or Join Date
            let loopDate = new Date(Math.max(PROJECT_START_DATE, joinDate));
            // Reset time to midnight
            loopDate.setHours(0, 0, 0, 0);

            while (loopDate <= yesterday) {
                const dateStr = loopDate.toISOString().split('T')[0];

                // 1. Check Attendance
                const [att] = await db.execute(
                    'SELECT id FROM attendance WHERE user_id = ? AND attendance_date = ?',
                    [emp.id, dateStr]
                );

                // 2. Check Leave
                const [leaves] = await db.execute(
                    'SELECT id FROM leave_requests WHERE user_id = ? AND status = "approved" AND ? BETWEEN start_date AND end_date',
                    [emp.id, dateStr]
                );

                // 3. Mark Absent if neither exists
                if (att.length === 0 && leaves.length === 0) {
                    // console.log(`Marking Absent: User ${emp.id} (${emp.name}) on ${dateStr}`);
                    await db.execute(
                        `INSERT INTO attendance (
                        user_id, attendance_date, status, check_in_time, check_out_time, marked_with_geo
                    ) VALUES (?, ?, 'absent', NULL, NULL, FALSE)`,
                        [emp.id, dateStr]
                    );

                    await logAudit(null, 'auto_absent_backfilled', {
                        user_id: emp.id,
                        date: dateStr,
                        reason: 'Backfill script'
                    });
                    totalMarked++;
                }

                // Next day
                loopDate.setDate(loopDate.getDate() + 1);
            }
        }

        console.log(`Backfill Complete. Marked ${totalMarked} records as Absent.`);
        process.exit(0);
    } catch (error) {
        console.error('Backfill failed:', error);
        process.exit(1);
    }
}

backfillAbsents();
