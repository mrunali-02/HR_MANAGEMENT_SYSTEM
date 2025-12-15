import db from './src/db/db.js';
import dotenv from 'dotenv';
dotenv.config();

async function checkData() {
    try {
        console.log("--- MANAGERS ---");
        const [managers] = await db.execute("SELECT id, email, name, role FROM employees WHERE role = 'manager'");
        console.table(managers);

        if (managers.length === 0) {
            console.log("No managers found.");
            process.exit(0);
        }

        for (const mgr of managers) {
            console.log(`\nChecking team for Manager: ${mgr.name} (${mgr.email}) [ID: ${mgr.id}]`);
            const [employees] = await db.execute("SELECT id, email, name FROM employees WHERE manager_id = ?", [mgr.id]);

            if (employees.length === 0) {
                console.log("  -> No employees assigned.");
                continue;
            }
            console.table(employees);

            const empIds = employees.map(e => e.id).join(',');
            if (empIds) {
                const [attendance] = await db.execute(`SELECT user_id, count(*) as count FROM attendance WHERE user_id IN (${empIds}) GROUP BY user_id`);
                console.log("  -> Attendance Records Counts:");
                console.table(attendance);
            }
        }
        process.exit(0);

    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

checkData();
