
import db from '../db/db.js';
import dotenv from 'dotenv';

dotenv.config();

async function runMigration() {
    let connection;
    try {
        connection = await db.getConnection();
        console.log('Starting WFH Enum Migration...');

        // 1. leave_requests
        await connection.query(`
      ALTER TABLE leave_requests 
      MODIFY COLUMN type ENUM('sick', 'casual', 'paid', 'work_from_home') NOT NULL
    `);
        console.log('✓ Updated leave_requests type ENUM');

        // 2. leave_balances
        await connection.query(`
      ALTER TABLE leave_balances 
      MODIFY COLUMN leave_type ENUM('sick', 'casual', 'paid', 'work_from_home') NOT NULL
    `);
        console.log('✓ Updated leave_balances leave_type ENUM');

        // 3. leave_policies
        await connection.query(`
      ALTER TABLE leave_policies 
      MODIFY COLUMN type ENUM('sick', 'casual', 'paid', 'work_from_home') NOT NULL
    `);
        console.log('✓ Updated leave_policies type ENUM');

        // 4. Insert default policy for WFH if not exists
        const [rows] = await connection.query("SELECT * FROM leave_policies WHERE type = 'work_from_home'");
        if (rows.length === 0) {
            await connection.query(`
        INSERT INTO leave_policies (name, type, total_days, carry_forward) 
        VALUES ('Work From Home', 'work_from_home', 100, 0)
      `);
            console.log('✓ Inserted default Work From Home policy (10 days)');
        } else {
            console.log('✓ Work From Home policy already exists');
        }

        console.log('Migration finished successfully.');
    } catch (err) {
        console.error('Migration failed:', err);
    } finally {
        if (connection) connection.release();
        process.exit();
    }
}

runMigration();
