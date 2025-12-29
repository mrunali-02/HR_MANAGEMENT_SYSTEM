import db from './src/db/db.js';
import dotenv from 'dotenv';

dotenv.config();

async function checkColumn() {
    try {
        const dbName = process.env.DB_NAME || 'hr_db';
        const [columns] = await db.execute(`
      SELECT COLUMN_NAME, DATA_TYPE, COLUMN_DEFAULT, COLUMN_COMMENT
      FROM information_schema.COLUMNS 
      WHERE TABLE_SCHEMA = ? 
        AND TABLE_NAME = 'leave_balances'
      ORDER BY ORDINAL_POSITION
    `, [dbName]);

        console.log('\n=== leave_balances table columns ===');
        columns.forEach(col => {
            console.log(`- ${col.COLUMN_NAME} (${col.DATA_TYPE}) ${col.COLUMN_NAME === 'carried_forward' ? '✓ FOUND' : ''}`);
        });
        console.log('\n');

        const hasCarriedForward = columns.some(col => col.COLUMN_NAME === 'carried_forward');
        if (hasCarriedForward) {
            console.log('✅ carried_forward column exists!');
        } else {
            console.log('❌ carried_forward column NOT found!');
        }

        await db.end();
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        await db.end();
        process.exit(1);
    }
}

checkColumn();
