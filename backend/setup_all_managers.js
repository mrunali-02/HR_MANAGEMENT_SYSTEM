import db from './src/db/db.js';
import { hashPassword } from './src/utils/hash.js';
import dotenv from 'dotenv';
dotenv.config();

async function setupAllManagers() {
    try {
        console.log("Scanning all managers...");
        const [managers] = await db.execute("SELECT id, email, name FROM employees WHERE role = 'manager'");

        if (managers.length === 0) {
            console.log("No managers found in the system.");
            process.exit(0);
        }

        const commonPassword = 'manager123';
        const hashedPassword = await hashPassword(commonPassword);

        console.log(`Resetting passwords to '${commonPassword}' and checking data...`);
        console.log("----------------------------------------------------------------");
        console.log("| Name | Email | Team Size | Attendance Records | Status |");
        console.log("----------------------------------------------------------------");

        for (const mgr of managers) {
            // Update password
            await db.execute('UPDATE employees SET password_hash = ? WHERE id = ?', [hashedPassword, mgr.id]);

            // Check Team Size
            const [[{ teamCount }]] = await db.execute("SELECT COUNT(*) as teamCount FROM employees WHERE manager_id = ?", [mgr.id]);

            // Check Attendance Data
            const [[{ attCount }]] = await db.execute(`
                SELECT COUNT(*) as attCount 
                FROM attendance a 
                JOIN employees e ON a.user_id = e.id 
                WHERE e.manager_id = ?
            `, [mgr.id]);

            const status = teamCount > 0
                ? (attCount > 0 ? "Active Data" : "Team Empty Data")
                : "No Team";

            console.log(`| ${mgr.name.padEnd(15)} | ${mgr.email.padEnd(20)} | ${String(teamCount).padEnd(9)} | ${String(attCount).padEnd(18)} | ${status} |`);
        }
        console.log("----------------------------------------------------------------");
        process.exit(0);

    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

setupAllManagers();
