
import axios from 'axios';
import dotenv from 'dotenv';
import db from './src/db/db.js';
import { generateToken } from './src/utils/token.js';

dotenv.config();

const API_Base = 'http://localhost:3001/api';

async function testLeaveManagement() {
    let mockUser = null;
    try {
        console.log('--- Setting up Test User for Leave Mgmt ---');
        // create temp user
        const email = `testleave_${Date.now()}@example.com`;
        const [res] = await db.execute(
            "INSERT INTO employees (email, password_hash, name, role) VALUES (?, 'hash', 'Leave Tester', 'employee')",
            [email]
        );
        const userId = res.insertId;

        // create token
        const token = generateToken();
        const expiresAt = new Date(Date.now() + 3600000);
        await db.execute("INSERT INTO api_tokens (user_id, token, expires_at) VALUES (?, ?, ?)", [userId, token, expiresAt]);

        mockUser = { id: userId, token };
        const headers = { Authorization: `Bearer ${token}` };

        // Init balance (manually or via first request which triggers it)
        // We rely on the controller to init it on first request if missing, or we can insert.
        // Let's rely on controller logic if implemented, or insert specifically to check.
        // Actually the controller auto-inits if missing.

        console.log(`Created test user ID: ${userId}`);

        // 1. Get Initial Balance (Should be 0s)
        console.log('\n--- Test 1: Get Initial Balance ---');
        let balRes = await axios.get(`${API_Base}/employee/${userId}/leave-balance`, { headers });
        console.log('Initial Balance:', balRes.data);
        if (balRes.data.sick !== 0) throw new Error('Expected 0 initial sick balance');

        // 2. Apply Sick Leave -> Should go negative (Deficit)
        console.log('\n--- Test 2: Apply Sick Leave (Deficit Check) ---');
        // Apply 2 days
        const start = '2025-01-01';
        const end = '2025-01-02';
        await axios.post(`${API_Base}/employee/${userId}/leaves`, {
            type: 'sick',
            start_date: start,
            end_date: end,
            reason: 'Testing deficit'
        }, { headers });
        console.log('Applied 2 days sick leave.');

        balRes = await axios.get(`${API_Base}/employee/${userId}/leave-balance`, { headers });
        console.log('Updated Balance:', balRes.data);

        if (balRes.data.sick === -2 && balRes.data.deficit.sick === -2) {
            console.log('SUCCESS: Sick balance went negative as expected.');
        } else {
            console.error('FAILED: Sick balance did not update correctly.', balRes.data);
        }

        // 3. Test Overlap
        console.log('\n--- Test 3: Overlap Check ---');
        try {
            await axios.post(`${API_Base}/employee/${userId}/leaves`, {
                type: 'sick', // try applying same days again
                start_date: start, // 2025-01-01
                end_date: end,     // 2025-01-02
                reason: 'Overlap attempt'
            }, { headers });
            console.error('FAILED: Should have rejected overlap.');
        } catch (e) {
            if (e.response?.data?.error?.includes('already have a leave request')) {
                console.log('SUCCESS: Rejected overlapping request.');
            } else {
                console.error('FAILED: Unexpected error on overlap', e.response?.data);
            }
        }

        // 4. Test Mixed Categories
        console.log('\n--- Test 4: Apply Casual Leave ---');
        await axios.post(`${API_Base}/employee/${userId}/leaves`, {
            type: 'casual',
            start_date: '2025-01-05',
            end_date: '2025-01-05',
            reason: 'Casual day'
        }, { headers });

        balRes = await axios.get(`${API_Base}/employee/${userId}/leave-balance`, { headers });
        if (balRes.data.casual === -1 && balRes.data.sick === -2) {
            console.log('SUCCESS: Categories tracked separately.');
        } else {
            console.error('FAILED: Category tracking issue.', balRes.data);
        }

    } catch (error) {
        console.error('Test Suite Error:', error);
        if (error.response) console.error('Response Data:', error.response.data);
    } finally {
        // Cleanup User
        if (mockUser) {
            console.log('\n--- Cleanup ---');
            await db.execute('DELETE FROM api_tokens WHERE user_id = ?', [mockUser.id]);
            await db.execute('DELETE FROM leave_requests WHERE user_id = ?', [mockUser.id]);
            await db.execute('DELETE FROM leave_balances WHERE user_id = ?', [mockUser.id]);
            await db.execute('DELETE FROM employees WHERE id = ?', [mockUser.id]);
            console.log('Cleanup complete.');
        }
        process.exit(0);
    }
}

testLeaveManagement();
