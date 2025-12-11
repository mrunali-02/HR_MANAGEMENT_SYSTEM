
import db from './src/db/db.js';
import dotenv from 'dotenv';

dotenv.config();

async function checkTable() {
    try {
        const [rows] = await db.execute("SHOW TABLES LIKE 'admin_notes'");
        if (rows.length > 0) {
            console.log('SUCCESS: admin_notes table exists.');
        } else {
            console.error('FAILURE: admin_notes table does NOT exist.');
            process.exit(1);
        }
    } catch (error) {
        console.error('Error checking table:', error);
        process.exit(1);
    } finally {
        process.exit(0);
    }
}

checkTable();
