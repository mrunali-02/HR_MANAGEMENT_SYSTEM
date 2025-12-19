import pool from './src/db/db.js';

async function testFix() {
    try {
        console.log('Testing insertion of work_from_home leave request...');

        // Check employees table first
        const [employees] = await pool.execute("SELECT id FROM employees LIMIT 1");
        if (employees.length === 0) {
            console.error("No employees found to test with.");
            process.exit(1);
        }
        const userId = employees[0].id;

        const [result] = await pool.execute(
            "INSERT INTO leave_requests (user_id, type, start_date, end_date, days, reason, status) VALUES (?, ?, CURDATE(), CURDATE(), 1, 'Testing Fix', 'pending')",
            [userId, 'work_from_home']
        );

        console.log('Insert successful! Insert ID:', result.insertId);

        // Clean up
        await pool.execute("DELETE FROM leave_requests WHERE id = ?", [result.insertId]);
        console.log('Test entry deleted.');

        process.exit(0);
    } catch (error) {
        console.error('Test failed:', error);
        process.exit(1);
    }
}

testFix();
