import db from './src/db/db.js';
import fs from 'fs/promises';

async function test() {
    let log = '';
    function appendLog(msg) {
        log += msg + '\n';
        console.log(msg);
    }

    try {
        appendLog('Testing connection...');
        await db.query('SELECT 1');
        appendLog('Connection success.');

        try {
            appendLog('Describing audit_logs...');
            const [schema] = await db.query('DESCRIBE audit_logs');
            appendLog('Schema: ' + JSON.stringify(schema, null, 2));
        } catch (e) {
            appendLog('Failed to describe audit_logs: ' + e.message);
        }

        appendLog('Testing audit_logs fetch mock...');
        try {
            const [logs] = await db.execute(`
        SELECT 
          al.id, al.user_id, al.action, al.metadata, al.created_at,
          e.name AS user_name, e.email AS user_email
        FROM audit_logs al
        LEFT JOIN employees e ON al.user_id = e.id
        ORDER BY al.created_at DESC
        LIMIT ? OFFSET ?
      `, [10, 0]);
            appendLog('Fetch success. Count: ' + logs.length);
        } catch (e) {
            appendLog('Fetch failed: ' + e.message);
            if (e.sql) appendLog('SQL: ' + e.sql);
        }

    } catch (error) {
        appendLog('Test failed fatal: ' + error.message);
    } finally {
        await fs.writeFile('debug-error.txt', log);
        process.exit();
    }
}

test();
