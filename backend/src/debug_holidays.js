
import db from './db/db.js';

async function debug() {
    try {
        console.log('Checking holidays table...');
        const [rows] = await db.execute('DESCRIBE holidays');
        console.log('Table Schema:', rows);

        console.log('Attempting test insertion...');
        // We need a valid employee ID for created_by. Let's pick the first admin.
        const [admins] = await db.execute("SELECT id FROM employees WHERE role='admin' LIMIT 1");
        if (admins.length === 0) {
            console.log('No admin found, trying any employee');
        }
        const userId = admins.length > 0 ? admins[0].id : 1;

        // Delete test entry if exists
        await db.execute("DELETE FROM holidays WHERE name='TEST_HOLIDAY'");

        const [res] = await db.execute(
            'INSERT INTO holidays (date, name, type, created_by) VALUES (?, ?, ?, ?)',
            ['2025-12-31', 'TEST_HOLIDAY', 'public', userId]
        );
        console.log('Insertion success:', res);

        // Clean up
        await db.execute("DELETE FROM holidays WHERE name='TEST_HOLIDAY'");
        console.log('Cleanup success');

    } catch (err) {
        console.error('Debug failed:', err);
    } finally {
        process.exit();
    }
}

debug();
