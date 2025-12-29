import db from '../db/db.js';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Migration: Add carried_forward column to leave_balances table
 */
async function addCarryForwardColumn() {
    let connection;

    try {
        connection = await db.getConnection();
        console.log('Starting Leave Carry Forward migration...');

        // Check if column already exists
        const dbName = process.env.DB_NAME || 'hr_db';
        const [columns] = await connection.execute(`
      SELECT COLUMN_NAME 
      FROM information_schema.COLUMNS 
      WHERE TABLE_SCHEMA = ? 
        AND TABLE_NAME = 'leave_balances' 
        AND COLUMN_NAME = 'carried_forward'
    `, [dbName]);

        if (columns.length > 0) {
            console.log('✓ carried_forward column already exists');
            return;
        }

        console.log('Adding carried_forward column...');

        // Add carried_forward column
        await connection.execute(`
      ALTER TABLE leave_balances 
      ADD COLUMN carried_forward INT NOT NULL DEFAULT 0 
      COMMENT 'Days carried forward from previous year'
    `);

        console.log('✓ Added carried_forward column to leave_balances');

        // Add index for better query performance
        try {
            await connection.execute(`
        CREATE INDEX idx_leave_balances_year_cf 
        ON leave_balances(year, carried_forward)
      `);
            console.log('✓ Added index for year and carried_forward columns');
        } catch (idxError) {
            if (idxError.code !== 'ER_DUP_KEYNAME') {
                console.error('Warning: Could not create index:', idxError.message);
            } else {
                console.log('✓ Index already exists');
            }
        }

        console.log('✓ Migration completed successfully!');

    } catch (error) {
        console.error('✗ Migration failed:', error);
        throw error;
    } finally {
        if (connection) {
            connection.release();
        }
        await db.end();
    }
}

// Always run the migration
addCarryForwardColumn()
    .then(() => {
        console.log('Exiting...');
        process.exit(0);
    })
    .catch((err) => {
        console.error('Fatal error:', err);
        process.exit(1);
    });
