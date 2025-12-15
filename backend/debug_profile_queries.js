import db from './src/db/db.js';

async function testQueries() {
    const managerId = 2; // Assuming 2 is a manager ID (man002) based on previous context

    console.log('Testing queries for Manager ID:', managerId);

    try {
        console.log('1. Testing User Details Query...');
        const [userRows] = await db.execute(
            `SELECT e.id, e.email, e.name, e.role, e.department, e.phone, e.joined_on, e.photo_url, e.address, 
              p.display_name, p.bio
       FROM employees e
       LEFT JOIN profiles p ON e.id = p.user_id
       WHERE e.id = ?`,
            [managerId]
        );
        console.log('   -> Success. Rows:', userRows.length);
    } catch (err) {
        console.error('   -> FAILED:', err.message);
    }

    try {
        console.log('2. Testing Team Members Query...');
        const [teamRows] = await db.execute(
            `SELECT id, name, email, role, department, photo_url 
       FROM employees 
       WHERE manager_id = ?`,
            [managerId]
        );
        console.log('   -> Success. Rows:', teamRows.length);
    } catch (err) {
        console.error('   -> FAILED:', err.message);
    }

    try {
        console.log('3. Testing Leave Stats Query...');
        const [leaveStats] = await db.execute(
            `SELECT 
         SUM(CASE WHEN lr.status = 'pending' THEN 1 ELSE 0 END) as pendingCount,
         SUM(CASE WHEN lr.status = 'approved' THEN 1 ELSE 0 END) as approvedCount,
         SUM(CASE WHEN lr.status = 'rejected' THEN 1 ELSE 0 END) as rejectedCount
       FROM leave_requests lr
       JOIN employees e ON lr.user_id = e.id
       WHERE e.manager_id = ?`,
            [managerId]
        );
        console.log('   -> Success.');
    } catch (err) {
        console.error('   -> FAILED:', err.message);
    }

    try {
        console.log('4. Testing Work Hours Query...');
        const [workHours] = await db.execute(
            `SELECT 
         SUM(TIMESTAMPDIFF(HOUR, check_in_time, check_out_time)) as monthHours
       FROM attendance
       WHERE user_id = ? 
         AND MONTH(attendance_date) = MONTH(CURRENT_DATE())
         AND YEAR(attendance_date) = YEAR(CURRENT_DATE())`,
            [managerId]
        );
        console.log('   -> Success.');
    } catch (err) {
        console.error('   -> FAILED:', err.message);
    }

    try {
        console.log('5. Testing Today Status Query...');
        const [todayStats] = await db.execute(
            `SELECT status, check_in_time, check_out_time 
       FROM attendance 
       WHERE user_id = ? AND attendance_date = CURDATE()`,
            [managerId]
        );
        console.log('   -> Success.');
    } catch (err) {
        console.error('   -> FAILED:', err.message);
    }

    process.exit();
}

testQueries();
