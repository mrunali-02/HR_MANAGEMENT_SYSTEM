import db from '../db/db.js';
import dotenv from 'dotenv';

dotenv.config();

async function migrate() {
    let connection;

    try {
        connection = await db.getConnection();
        console.log('Starting migration to add "comp_off" leave type...');

        // 1. Update leave_requests table ENUM
        console.log('Updating leave_requests.type ENUM...');
        await connection.execute(`
      ALTER TABLE leave_requests 
      MODIFY COLUMN type ENUM('sick', 'casual', 'paid', 'work_from_home', 'emergency', 'comp_off') NOT NULL
    `);
        console.log('✓ Updated leave_requests.type');

        // 2. Update leave_balances table ENUM
        console.log('Updating leave_balances.leave_type ENUM...');
        await connection.execute(`
      ALTER TABLE leave_balances 
      MODIFY COLUMN leave_type ENUM('sick', 'casual', 'paid', 'work_from_home', 'emergency', 'comp_off') NOT NULL
    `);
        console.log('✓ Updated leave_balances.leave_type');

        // 3. Update leave_policies table ENUM
        console.log('Updating leave_policies.type ENUM...');
        await connection.execute(`
      ALTER TABLE leave_policies 
      MODIFY COLUMN type ENUM('sick', 'casual', 'paid', 'work_from_home', 'emergency', 'comp_off') NOT NULL
    `);
        console.log('✓ Updated leave_policies.type');

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
