import db from './src/db/db.js';

async function addDaysColumn() {
    try {
        console.log('Attempting to add days column to leave_requests...');
        await db.execute('ALTER TABLE leave_requests ADD COLUMN days INT DEFAULT 1 AFTER end_date');
        console.log('Successfully added days column.');
    } catch (error) {
        if (error.code === 'ER_DUP_FIELDNAME') {
            console.log('Column days already exists.');
        } else {
            console.error('Error adding column:', error);
        }
    } finally {
        process.exit();
    }
}

addDaysColumn();
