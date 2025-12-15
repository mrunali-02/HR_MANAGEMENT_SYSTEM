import db from './src/db/db.js';
import dotenv from 'dotenv';
dotenv.config();

async function seedLeaves() {
    try {
        // Get managers with teams
        const [managers] = await db.execute(`
            SELECT DISTINCT m.id as mgr_id, e.id as emp_id, e.name as emp_name
            FROM employees m
            JOIN employees e ON m.id = e.manager_id
            WHERE m.role = 'manager'
            LIMIT 3
        `);

        if (managers.length === 0) {
            console.log("No manager teams found.");
            process.exit(0);
        }

        console.log("Seeding leave requests...");

        for (const row of managers) {
            await db.execute(`
                INSERT INTO leave_requests (user_id, type, start_date, end_date, reason, status)
                VALUES (?, 'casual', CURDATE(), DATE_ADD(CURDATE(), INTERVAL 2 DAY), 'Personal work', 'pending')
            `, [row.emp_id]);
            console.log(`Added leave for ${row.emp_name}`);
        }

        console.log("Done!");
        process.exit(0);
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
}

seedLeaves();
