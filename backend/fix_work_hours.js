import db from './src/db/db.js';
import dotenv from 'dotenv';
dotenv.config();

async function fixWorkHoursData() {
    try {
        console.log("Checking Attendance Data for Check-Outs...");

        // Count records with check_out_time
        const [[countRes]] = await db.execute("SELECT COUNT(*) as completed_count FROM attendance WHERE check_out_time IS NOT NULL");
        console.log(`Completed Attendance Records: ${countRes.completed_count}`);

        if (countRes.completed_count < 5) {
            console.log("Not enough completed records. Updating some records to have checkout time...");

            // Fix: Update some recent records to have check_out_time 9 hours after check_in_time
            // Only update if check_in_time is present and check_out_time is NULL
            const [updateRes] = await db.execute(`
                UPDATE attendance 
                SET check_out_time = ADDTIME(check_in_time, '09:00:00') 
                WHERE check_in_time IS NOT NULL 
                  AND check_out_time IS NULL
                  AND attendance_date <= CURDATE()
            `);
            console.log(`Updated ${updateRes.affectedRows} records with mock check-out times.`);
        }

        // Verify `man001` or `man002` team specifically
        console.log("\nVerifying Manager Teams Work Hours Potential:");
        const [managers] = await db.execute("SELECT id, name, email FROM employees WHERE role='manager'");

        for (const mgr of managers) {
            const [[{ potential }]] = await db.execute(`
                SELECT COUNT(*) as potential
                FROM attendance a
                JOIN employees e ON a.user_id = e.id
                WHERE e.manager_id = ?
                  AND a.check_in_time IS NOT NULL
                  AND a.check_out_time IS NOT NULL
             `, [mgr.id]);
            console.log(`Manager ${mgr.email}: ${potential} records with calculated hours.`);
        }
        process.exit(0);
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
}

fixWorkHoursData();
