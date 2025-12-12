import db from './src/db/db.js';

async function checkUsers() {
    try {
        const [rows] = await db.execute('SELECT id, email, role, name FROM employees');
        console.log('Employees found:', rows.length);
        console.table(rows);
        process.exit(0);
    } catch (err) {
        console.error('Error:', err);
        process.exit(1);
    }
}

checkUsers();
