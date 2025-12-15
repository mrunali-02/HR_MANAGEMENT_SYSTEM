import db from './src/db/db.js';
import { hashPassword } from './src/utils/hash.js';
import dotenv from 'dotenv';
dotenv.config();

const API_URL = 'http://localhost:3001/api';
const EMAIL = 'man002@gmail.com';
const PASSWORD = 'manager123';

async function testLeavesAPI() {
    try {
        console.log(`Testing Login for ${EMAIL}...`);
        const loginRes = await fetch(`${API_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: EMAIL, password: PASSWORD })
        });

        const loginData = await loginRes.json();
        if (!loginRes.ok) throw new Error(JSON.stringify(loginData));
        const { token } = loginData;

        console.log('Fetching Team Leave Requests...');
        const res = await fetch(`${API_URL}/manager/team/leave-requests`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const data = await res.json();
        console.log('API Response Structure:', JSON.stringify(data).substring(0, 100) + '...');

        if (data.requests && Array.isArray(data.requests)) {
            console.log(`Found ${data.requests.length} requests via API.`);
            console.table(data.requests.slice(0, 2));
        } else if (Array.isArray(data)) {
            console.log(`Found ${data.length} requests via API (direct array).`);
        } else {
            console.log('Unexpected structure.');
        }

    } catch (error) {
        console.error('Test Failed:', error);
    }
}

testLeavesAPI();
