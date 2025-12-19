
import db from './src/db/db.js';
import dotenv from 'dotenv';
dotenv.config();

async function checkData() {
    try {
        const connection = await db.getConnection();
        const [rows] = await connection.execute("SELECT * FROM leave_policies WHERE type = 'emergency'");
        console.log('Emergency Rows:', rows.length);
        if (rows.length > 0) console.log(rows);
        connection.release();
    } catch (err) {
        console.error(err);
    } finally {
        process.exit();
    }
}

checkData();
