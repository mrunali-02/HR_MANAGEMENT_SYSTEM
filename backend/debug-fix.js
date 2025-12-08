import db from './src/db/db.js';
import fs from 'fs/promises';

async function test() {
    let log = '';
    function appendLog(msg) {
        log += msg + '\n';
        console.log(msg);
    }

    try {
        const limit = 10;
        const offset = 0;

        appendLog('Testing fix with string interpolation...');
        try {
            const [logs] = await db.execute(`
        SELECT 
          al.id, al.user_id, al.action, al.metadata, al.created_at,
          e.name AS user_name, e.email AS user_email
        FROM audit_logs al
        LEFT JOIN employees e ON al.user_id = e.id
        ORDER BY al.created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `);
            appendLog('Fix success! Count: ' + logs.length);
        } catch (e) {
            appendLog('Fix failed: ' + e.message);
            if (e.sql) appendLog('SQL: ' + e.sql);
        }

    } catch (error) {
        appendLog('Test failed fatal: ' + error.message);
    } finally {
        await fs.writeFile('debug-fix.txt', log);
        process.exit();
    }
}

test();
