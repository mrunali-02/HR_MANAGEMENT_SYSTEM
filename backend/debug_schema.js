
import db from './src/db/db.js';
import dotenv from 'dotenv';
dotenv.config();

async function checkSchema() {
    try {
        const connection = await db.getConnection();
        const [rows] = await connection.execute("SHOW CREATE TABLE leave_policies");
        console.log(rows[0]['Create Table']);
        connection.release();
    } catch (err) {
        console.error(err);
    } finally {
        process.exit();
    }
}

checkSchema();
