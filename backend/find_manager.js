import db from './src/db/db.js';
import dotenv from 'dotenv';
dotenv.config();

async function findManager() {
    try {
        const query = `
            SELECT m.id, m.email, m.name, COUNT(a.id) as attendance_count 
            FROM employees m 
            JOIN employees e ON m.id = e.manager_id 
            JOIN attendance a ON e.id = a.user_id 
            WHERE m.role = 'manager'
            GROUP BY m.id
        `;
        const [rows] = await db.execute(query);
        console.table(rows);

        if (rows.length > 0) {
            console.log(`Found manager: ${rows[0].email}`);
        } else {
            console.log("No managers with team attendance found.");
        }
        process.exit(0);
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
}
findManager();
