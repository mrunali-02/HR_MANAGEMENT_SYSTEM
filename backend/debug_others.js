
import db from './src/db/db.js';
import dotenv from 'dotenv';
dotenv.config();

async function checkOtherTables() {
    try {
        const connection = await db.getConnection();

        // Check leave_requests
        try {
            const [reqRows] = await connection.execute("SELECT count(*) as cnt FROM leave_requests WHERE type = 'emergency'");
            console.log('Leave Requests with emergency:', reqRows[0].cnt);
        } catch (e) { console.log("leave_requests table might not exist or no type col"); }

        // Check leave_balances
        try {
            const [balRows] = await connection.execute("SELECT count(*) as cnt FROM leave_balances WHERE leave_type = 'emergency'");
            console.log('Leave Balances with emergency:', balRows[0].cnt);
        } catch (e) { console.log("leave_balances table might not exist or no leave_type col"); }

        connection.release();
    } catch (err) {
        console.error(err);
    } finally {
        process.exit();
    }
}

checkOtherTables();
