
import db from './src/db/db.js';
import dotenv from 'dotenv';
dotenv.config();

async function checkColumnType() {
    try {
        const connection = await db.getConnection();
        const [rows] = await connection.execute(`
      SELECT COLUMN_TYPE 
      FROM information_schema.COLUMNS 
      WHERE TABLE_SCHEMA = '${process.env.DB_NAME || 'hr_db'}' 
      AND TABLE_NAME = 'leave_policies' 
      AND COLUMN_NAME = 'type'
    `);
        console.log('COLUMN_TYPE:', rows[0]?.COLUMN_TYPE);
        connection.release();
    } catch (err) {
        console.error(err);
    } finally {
        process.exit();
    }
}

checkColumnType();
