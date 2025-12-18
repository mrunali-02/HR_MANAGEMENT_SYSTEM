import db from '../db/db.js';

async function checkGaps() {
    try {
        console.log('Checking for missing attendance records...');

        // Get all employees
        const [employees] = await db.execute("SELECT id, name, joined_on FROM employees WHERE role = 'employee'");

        let totalMissing = 0;

        for (const emp of employees) {
            const joinDate = new Date(emp.joined_on);
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            // Iterate from join date to yesterday
            for (let d = new Date(joinDate); d < today; d.setDate(d.getDate() + 1)) {
                // Skip weekends if needed (assuming Mon-Fri? Or just all days?)
                // For now, check all days.

                const dateStr = d.toISOString().split('T')[0];

                // Check attendance
                const [att] = await db.execute(
                    'SELECT id FROM attendance WHERE user_id = ? AND attendance_date = ?',
                    [emp.id, dateStr]
                );

                if (att.length === 0) {
                    // Check leave
                    const [leaves] = await db.execute(
                        'SELECT id FROM leave_requests WHERE user_id = ? AND status = "approved" AND ? BETWEEN start_date AND end_date',
                        [emp.id, dateStr]
                    );

                    if (leaves.length === 0) {
                        totalMissing++;
                        // console.log(`User ${emp.name} missing: ${dateStr}`);
                    }
                }
            }
        }

        console.log(`Total missing person-days found: ${totalMissing}`);
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

checkGaps();
