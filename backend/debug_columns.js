
import db from './src/db/db.js';
import dotenv from 'dotenv';
dotenv.config();

async function check() {
    try {
        const [rows] = await db.execute("SHOW COLUMNS FROM employees");
        console.log('Columns in employees table:');
        rows.forEach(r => console.log(`- ${r.Field} (${r.Type})`));

        const [users] = await db.execute("SELECT id, email, name FROM employees LIMIT 5");
        console.log('Users found:', users.length);
        console.log(users);

        const [test] = await db.execute("SELECT designation FROM employees LIMIT 1");
        console.log('Query with designation passed');
    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        process.exit();
    }
}

check();
