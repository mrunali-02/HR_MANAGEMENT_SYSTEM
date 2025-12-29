import db from './src/db/db.js';

async function checkHrUsers() {
    try {
        const [hrUsers] = await db.execute('SELECT id, name, email, role FROM employees WHERE role = "hr"');
        console.log('HR Users in DB:', hrUsers);

        const [allRoles] = await db.execute('SELECT DISTINCT role FROM employees');
        console.log('Available Roles in DB:', allRoles.map(r => r.role));

        // Check the first HR user's tokens
        if (hrUsers.length > 0) {
            const [tokens] = await db.execute('SELECT * FROM api_tokens WHERE user_id = ?', [hrUsers[0].id]);
            console.log(`Tokens for ${hrUsers[0].email}:`, tokens);
        }

    } catch (err) {
        console.error('Database check failed:', err);
    } finally {
        process.exit(0);
    }
}

checkHrUsers();
