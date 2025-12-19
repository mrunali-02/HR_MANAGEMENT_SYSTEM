import db from '../db/db.js';

console.log('Testing DB connection...');
try {
    const [rows] = await db.execute('SELECT 1');
    console.log('Connection successful:', rows);
    process.exit(0);
} catch (err) {
    console.error('Connection failed:', err);
    process.exit(1);
}
