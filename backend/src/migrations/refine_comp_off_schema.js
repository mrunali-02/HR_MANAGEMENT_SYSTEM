import db from '../db/db.js';
import dotenv from 'dotenv';

dotenv.config();

async function migrate() {
    let connection;

    try {
        connection = await db.getConnection();
        console.log('Starting migration to refine "comp_off" schema...');

        // 1. Add working dates to leave_requests
        console.log('Adding working_start_date and working_end_date to leave_requests...');
        try {
            await connection.execute(`
        ALTER TABLE leave_requests 
        ADD COLUMN working_start_date DATE NULL,
        ADD COLUMN working_end_date DATE NULL
      `);
            console.log('✓ Added working date columns');
        } catch (err) {
            console.log('Note: working date columns might already exist:', err.message);
        }

        // 2. Update attendance status ENUM
        console.log('Updating attendance.status ENUM...');
        await connection.execute(`
      ALTER TABLE attendance 
      MODIFY COLUMN status ENUM('present', 'absent', 'remote', 'leave', 'comp_off') NOT NULL DEFAULT 'present'
    `);
        console.log('✓ Updated attendance.status ENUM');

        console.log('Migration completed successfully!');
    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        if (connection) {
            connection.release();
        }
        process.exit(0);
    }
}

migrate();
