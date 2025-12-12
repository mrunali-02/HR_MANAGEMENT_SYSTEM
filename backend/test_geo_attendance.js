
import axios from 'axios';
import dotenv from 'dotenv';
import db from './src/db/db.js';
import { generateToken } from './src/utils/token.js';

dotenv.config();

const API_Base = 'http://localhost:3001/api';
// Default office (Bangalore)
const OFFICE_LAT = 19.108139;
const OFFICE_LNG = 73.019611;
const MAX_DISTANCE = 1000; // meters

async function testGeo() {
    let mockUser = null;
    try {
        console.log('--- Setting up Test User ---');
        // create temp user
        const email = `testgeo_${Date.now()}@example.com`;
        const [res] = await db.execute(
            "INSERT INTO employees (email, password_hash, name, role) VALUES (?, 'hash', 'Geo Tester', 'employee')",
            [email]
        );
        const userId = res.insertId;

        // create token
        const token = generateToken();
        const expiresAt = new Date(Date.now() + 3600000);
        await db.execute("INSERT INTO api_tokens (user_id, token, expires_at) VALUES (?, ?, ?)", [userId, token, expiresAt]);

        mockUser = { id: userId, token };
        console.log(`Created test user ID: ${userId}`);

        // 1. Test Success (Within 50m of office)
        console.log('\n--- Test 1: Successful Check-in (Near Office) ---');
        try {
            const resp = await axios.post(`${API_Base}/employee/${userId}/attendance/mark`, {
                latitude: OFFICE_LAT + 0.0001, // Very close
                longitude: OFFICE_LNG + 0.0001,
                accuracy: 10
            }, { headers: { Authorization: `Bearer ${token}` } });
            console.log('SUCCESS: ', resp.data);
        } catch (e) {
            console.error('FAILED Test 1:', e.response?.data || e.message);
        }

        // Clean up attendance for next test
        await db.execute('DELETE FROM attendance WHERE user_id = ?', [userId]);

        // 2. Test Fail (Too far)
        console.log('\n--- Test 2: Fail Check-in (Too Far - 10km away) ---');
        try {
            await axios.post(`${API_Base}/employee/${userId}/attendance/mark`, {
                latitude: OFFICE_LAT + 0.1, // ~11km away
                longitude: OFFICE_LNG,
                accuracy: 10
            }, { headers: { Authorization: `Bearer ${token}` } });
            console.error('FAILED Test 2: Should have rejected but succeeded.');
        } catch (e) {
            if (e.response?.status === 400 && e.response?.data?.distance) {
                console.log('SUCCESS: Rejected as expected. Distance:', e.response.data.distance);
            } else {
                console.error('FAILED Test 2: Unexpected error', e.response?.data || e.message);
            }
        }

        // Clean up attendance 
        await db.execute('DELETE FROM attendance WHERE user_id = ?', [userId]);

        // 3. Test Fail (Low Accuracy)
        console.log('\n--- Test 3: Fail Check-in (Low Accuracy > 50m) ---');
        try {
            await axios.post(`${API_Base}/employee/${userId}/attendance/mark`, {
                latitude: OFFICE_LAT,
                longitude: OFFICE_LNG,
                accuracy: 100 // Bad accuracy
            }, { headers: { Authorization: `Bearer ${token}` } });
            console.error('FAILED Test 3: Should have rejected due to accuracy.');
        } catch (e) {
            if (e.response?.status === 400 && e.response?.data?.error?.includes('accuracy')) {
                console.log('SUCCESS: Rejected due to accuracy:', e.response.data.error);
            } else {
                console.error('FAILED Test 3: Unexpected error', e.response?.data || e.message);
            }
        }

    } catch (error) {
        console.error('Test Suite Error:', error);
    } finally {
        // Cleanup User
        if (mockUser) {
            console.log('\n--- Cleanup ---');
            await db.execute('DELETE FROM api_tokens WHERE user_id = ?', [mockUser.id]);
            await db.execute('DELETE FROM employees WHERE id = ?', [mockUser.id]);
            await db.execute('DELETE FROM attendance WHERE user_id = ?', [mockUser.id]);
            console.log('Cleanup complete.');
        }
        process.exit(0);
    }
}

testGeo();
