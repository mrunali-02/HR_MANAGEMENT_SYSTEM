import { hashPassword } from './src/utils/hash.js';
import dotenv from 'dotenv';
dotenv.config();

const API_URL = 'http://localhost:3001/api';
const EMAIL = 'man002@gmail.com';
const PASSWORD = 'manager123';

async function testLeaves() {
    try {
        console.log("1. Logging in...");
        const loginRes = await fetch(`${API_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: EMAIL, password: PASSWORD })
        });
        const loginData = await loginRes.json();
        if (!loginRes.ok) throw new Error("Login failed: " + JSON.stringify(loginData));
        const token = loginData.token;

        console.log("2. Fetching Leave Requests...");
        const res = await fetch(`${API_URL}/manager/team/leave-requests`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const data = await res.json();
        if (!res.ok) {
            console.log("API Error Status:", res.status);
            console.log("API Error Body:", data);
        } else {
            console.log("API Success!");
            console.log("Request Count:", data.requests ? data.requests.length : 'N/A');
            if (data.requests && data.requests.length > 0) {
                console.log("First Request:", data.requests[0]);
            } else {
                console.log("Data:", data);
            }
        }

    } catch (e) {
        console.error("Script Error:", e);
    }
}

testLeaves();
