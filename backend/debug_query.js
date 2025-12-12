import db from './src/db/db.js';

async function testQuery() {
    try {
        const query = `
      SELECT 
        e.id, 
        e.employee_id, 
        e.email, 
        REPLACE(e.name, ',', '') AS name, 
        e.first_name,
        e.middle_name,
        e.last_name,
        e.status, 
        e.role, 
        e.department, 
        e.phone, 
        e.joined_on, 
        e.address, 
        e.dob,
        e.gender,
        e.blood_group,
        e.nationality,
        e.emergency_contact,
        e.manager_id,
        e.created_at,
        REPLACE(m.name, ',', '') AS manager_name,
        m.email AS manager_email
      FROM employees e
      LEFT JOIN employees m ON e.manager_id = m.id
      ORDER BY e.created_at DESC
    `;
        const [rows] = await db.execute(query);
        console.log('Query success. Rows:', rows.length);
    } catch (err) {
        console.error('Query failed:', err.message);
        if (err.sqlMessage) console.error('SQL Message:', err.sqlMessage);
    } finally {
        process.exit();
    }
}

testQuery();
