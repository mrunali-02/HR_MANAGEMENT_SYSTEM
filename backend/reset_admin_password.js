import db from './src/db/db.js';
import { hashPassword } from './src/utils/hash.js';
import dotenv from 'dotenv';
dotenv.config();

async function resetPassword() {
    try {
        const email = 'admin@gmail.com';
        const newPassword = 'admin123';

        console.log(`Resetting password for ${email} to '${newPassword}'...`);

        // Check if user exists
        const [users] = await db.execute('SELECT id FROM employees WHERE email = ?', [email]);

        if (users.length === 0) {
            console.error(`User ${email} not found!`);
            process.exit(1);
        }

        const hashedPassword = await hashPassword(newPassword);

        await db.execute('UPDATE employees SET password_hash = ? WHERE email = ?', [hashedPassword, email]);

        console.log('Password reset successfully!');
        process.exit(0);
    } catch (error) {
        console.error('Error resetting password:', error);
        process.exit(1);
    }
}

resetPassword();
