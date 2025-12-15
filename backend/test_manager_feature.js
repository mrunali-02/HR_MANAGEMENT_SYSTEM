import db from './src/db/db.js';
import { hashPassword } from './src/utils/hash.js';
import dotenv from 'dotenv';
dotenv.config();

const API_URL = 'http://localhost:3001/api';
const EMAIL = 'man002@gmail.com';
const PASSWORD = 'manager123';

async function testManagerFlow() {
    try {
        console.log(`1. Resetting password for ${EMAIL}...`);
        const hashedPassword = await hashPassword(PASSWORD);
        await db.execute('UPDATE employees SET password_hash = ? WHERE email = ?', [hashedPassword, EMAIL]);
        console.log('   Password reset done.');

        console.log('2. Attempting Login...');
        const loginRes = await fetch(`${API_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: EMAIL, password: PASSWORD })
        });

        const loginData = await loginRes.json();

        if (!loginRes.ok) throw new Error(JSON.stringify(loginData));

        const { token } = loginData;
        console.log('   Login successful. Token obtained.');

        console.log('3. Fetching Team Attendance...');
        const attRes = await fetch(`${API_URL}/manager/team/attendance`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const attData = await attRes.json();
        if (!attRes.ok) throw new Error(JSON.stringify(attData));

        console.log('   Attendance Records Found:', attData.attendance.length);
        if (attData.attendance.length > 0) {
            console.log('   First Record:', attData.attendance[0]);
        } else {
            console.log('   WARNING: No attendance records returned (but DB said otherwise?).');
        }

    } catch (error) {
        console.error('Test Failed:', error);
    } finally {
        process.exit(0);
    }
}

testManagerFlow();
