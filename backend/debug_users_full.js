import db from './src/db/db.js';

async function checkUsers() {
    try {
        const [rows] = await db.execute('SELECT * FROM employees LIMIT 1');
        console.log('Keys:', Object.keys(rows[0] || {}));
        process.exit(0);
    } catch (err) {
        console.error('Error:', err);
        process.exit(1);
    }
}

checkUsers();
