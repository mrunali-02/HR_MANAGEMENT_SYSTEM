import db from './src/db/db.js';
import dotenv from 'dotenv';
dotenv.config();

async function testSQL() {
    try {
        console.log("Testing SQL Query...");
        const query = `
          SELECT
            lr.id,
            lr.user_id,
            lr.type,
            lr.start_date,
            lr.end_date,
            DATEDIFF(lr.end_date, lr.start_date) + 1 AS days,
            lr.document_url,
            lr.reason,
            lr.status,
            lr.created_at,
            lr.reviewed_by,
            e.name  AS employee_name,
            e.email AS employee_email
          FROM leave_requests lr
          JOIN employees e ON lr.user_id = e.id
          WHERE e.manager_id = 7
          ORDER BY lr.created_at DESC
        `;
        const [rows] = await db.execute(query);
        console.log("SQL Success! Rows:", rows.length);
        if (rows.length > 0) console.log(rows[0]);
    } catch (e) {
        console.error("SQL Error:", e);
    } finally {
        process.exit(0);
    }
}

testSQL();
