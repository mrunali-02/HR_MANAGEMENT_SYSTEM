import pool from './src/db/db.js';

async function checkSchema() {
    try {
        const [rows] = await pool.execute("SHOW COLUMNS FROM leave_requests LIKE 'type'");
        console.log('Current Type:', rows[0].Type);
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

checkSchema();
