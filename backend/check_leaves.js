import db from './src/db/db.js';
import dotenv from 'dotenv';
dotenv.config();

async function checkLeaves() {
    try {
        console.log("Checking seeded leave requests...");

        const [rows] = await db.execute(`
            SELECT 
                lr.id, 
                lr.status, 
                e.name as employee_name, 
                m.email as manager_email,
                m.id as manager_id
            FROM leave_requests lr
            JOIN employees e ON lr.user_id = e.id
            JOIN employees m ON e.manager_id = m.id
            WHERE lr.reason = 'Personal work'
        `);

        console.table(rows);

        if (rows.length > 0) {
            console.log(`\nTo view these requests, please login as: ${rows[0].manager_email}`);
        } else {
            console.log("No 'Personal work' leave requests found.");
        }
        process.exit(0);
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
}

checkLeaves();
