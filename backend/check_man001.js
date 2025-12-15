import db from './src/db/db.js';
import dotenv from 'dotenv';
dotenv.config();

async function checkMan001() {
    try {
        const email = 'man001@gmail.com'; // Assuming man001 refers to this email pattern based on previous logs
        console.log(`Checking data for ${email}...`);

        const [managers] = await db.execute("SELECT id, name, email FROM employees WHERE email LIKE 'man001%'");
        if (managers.length === 0) {
            console.log("Manager 'man001' not found!");
            process.exit(0);
        }

        const mgr = managers[0];
        console.log(`Found Manager: ${mgr.name} (ID: ${mgr.id})`);

        const [employees] = await db.execute("SELECT id, name, email FROM employees WHERE manager_id = ?", [mgr.id]);
        console.log(`Team Size: ${employees.length}`);

        if (employees.length > 0) {
            console.table(employees);
            const empIds = employees.map(e => e.id).join(',');
            const [attendance] = await db.execute(`SELECT * FROM attendance WHERE user_id IN (${empIds}) LIMIT 5`);
            console.log(`Total Attendance Records for Team: ${attendance.length} (showing top 5)`);
            console.table(attendance);
        } else {
            console.log("No employees assigned to this manager.");
        }
        process.exit(0);
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
}

checkMan001();
