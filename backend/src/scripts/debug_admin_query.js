import db from '../db/db.js';
import dotenv from 'dotenv';
dotenv.config();

async function debugQuery() {
  try {
    console.log('Using shared DB connection');

    // Simulate query params
    const limit = 10;
    const offset = 0;
    const startDate = undefined; // defaults in controller
    const endDate = undefined;
    const department = undefined;

    let whereClause = 'WHERE 1=1';
    const params = [];

    // Main query copied from adminController.js (with fixed syntax)
    const query = `
      SELECT 
        a.id, a.user_id, e.name as employee_name, e.email as employee_email, e.department,
        a.attendance_date as date, a.status, 
        a.check_in_time, a.check_out_time, 
        TIME_FORMAT(
          SEC_TO_TIME(
            TIMESTAMPDIFF(
              SECOND,
              CONCAT(a.attendance_date, ' ', a.check_in_time),
              CONCAT(a.attendance_date, ' ', a.check_out_time)
            )
          ),
          '%H:%i'
        ) as total_hours,
        wh.is_late,
        wh.is_left_early
      FROM attendance a
      JOIN employees e ON a.user_id = e.id
      LEFT JOIN work_hours wh ON a.id = wh.attendance_id
      ${whereClause}
      ORDER BY a.attendance_date DESC, a.check_in_time DESC
    `;

    console.log('Generated Query:', query);
    console.log('Executing query...');
    const [rows] = await db.execute(query, params);

    console.log(`Found ${rows.length} rows`);
    if (rows.length > 0) {
      console.log('Sample Row:', JSON.stringify(rows[0], null, 2));

      // Analyze roles
      const roles = {};
      rows.forEach(r => {
        // fetch role if not in query, but assuming joined employees has it.
        // Wait, query selects e.department, let's see if we can get role too.
      });
    } else {
      const [allRows] = await db.execute('SELECT * FROM attendance LIMIT 5');
      console.log('Raw Attendance Rows:', JSON.stringify(allRows, null, 2));
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    process.exit(0);
  }
}

debugQuery();
