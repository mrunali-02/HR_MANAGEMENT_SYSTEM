import db from './src/db/db.js';
import { hashPassword } from './src/utils/hash.js';
import dotenv from 'dotenv';
dotenv.config();

async function seedAllManagers() {
    try {
        console.log("Starting Universal Data Seeding...");

        // 1. Get All Managers
        const [managers] = await db.execute("SELECT id, name, email FROM employees WHERE role = 'manager'");
        console.log(`Found ${managers.length} managers.`);

        for (const mgr of managers) {
            console.log(`Processing Manager: ${mgr.email}...`);

            // 2. Ensure Manager has at least 1 Employee
            let [employees] = await db.execute("SELECT id, email FROM employees WHERE manager_id = ?", [mgr.id]);

            if (employees.length === 0) {
                console.log(`  -> Creating dummy employee for ${mgr.name}`);
                const dummyEmail = `emp_${mgr.id}@test.com`;
                const dummyPass = await hashPassword('password123');
                const [res] = await db.execute(
                    `INSERT INTO employees (name, email, password_hash, role, manager_id, department, designation, created_at) 
                     VALUES (?, ?, ?, 'employee', ?, 'IT', 'Developer', NOW())`,
                    [`Employee of ${mgr.name}`, dummyEmail, dummyPass, mgr.id]
                );
                employees = [{ id: res.insertId, email: dummyEmail }];
            }

            // 3. Seed Data for their Team
            for (const emp of employees) {
                // A. Attendance (Past 3 days)
                for (let i = 0; i < 3; i++) {
                    // Check if exists
                    const [exists] = await db.execute(
                        `SELECT id FROM attendance WHERE user_id = ? AND attendance_date = DATE_SUB(CURDATE(), INTERVAL ? DAY)`,
                        [emp.id, i]
                    );

                    if (exists.length === 0) {
                        await db.execute(
                            `INSERT INTO attendance (user_id, attendance_date, status, check_in_time, check_out_time, created_at)
                             VALUES (?, DATE_SUB(CURDATE(), INTERVAL ? DAY), 'present', '09:00:00', '18:00:00', NOW())`,
                            [emp.id, i]
                        );
                    } else {
                        // Ensure checkout exists
                        await db.execute(
                            `UPDATE attendance SET check_out_time = '18:00:00' WHERE id = ? AND check_out_time IS NULL`,
                            [exists[0].id]
                        );
                    }
                }

                // B. Leave Requests
                const [leaves] = await db.execute("SELECT id FROM leave_requests WHERE user_id = ?", [emp.id]);
                if (leaves.length === 0) {
                    await db.execute(
                        `INSERT INTO leave_requests (user_id, type, start_date, end_date, reason, status, created_at)
                         VALUES (?, 'sick', DATE_ADD(CURDATE(), INTERVAL 5 DAY), DATE_ADD(CURDATE(), INTERVAL 6 DAY), 'Not feeling well', 'pending', NOW())`,
                        [emp.id]
                    );
                    console.log(`  -> Added leave request for emp ${emp.id}`);
                }
            }
        }

        console.log("Universal Seeding Complete!");
        process.exit(0);

    } catch (error) {
        console.error("Seeding Failed:", error);
        process.exit(1);
    }
}

seedAllManagers();
