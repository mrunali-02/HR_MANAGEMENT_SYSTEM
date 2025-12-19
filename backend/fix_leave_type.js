import pool from './src/db/db.js';

async function fixSchema() {
    try {
        console.log('Altering table leave_requests...');
        await pool.execute("ALTER TABLE leave_requests MODIFY COLUMN type ENUM('sick', 'casual', 'paid', 'emergency', 'work_from_home') NOT NULL");
        console.log('Successfully updated leave_requests type ENUM.');
        process.exit(0);
    } catch (error) {
        console.error('Error applying fix:', error);
        process.exit(1);
    }
}

fixSchema();
