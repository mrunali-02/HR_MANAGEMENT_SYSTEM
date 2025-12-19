import db from './src/db/db.js';
import dotenv from 'dotenv';
dotenv.config();

async function reproduce() {
    try {
        console.log('--- Reproduction Script ---');

        // 1. Get a user
        const [users] = await db.execute("SELECT id FROM employees LIMIT 1");
        if (users.length === 0) {
            console.log('No employees found.');
            return;
        }
        const userId = users[0].id;
        console.log('Using User ID:', userId);

        // 2. Ensure checked in
        const [existing] = await db.execute(
            'SELECT id, check_in_time, check_out_time FROM attendance WHERE user_id = ? AND attendance_date = CURDATE()',
            [userId]
        );

        if (existing.length === 0) {
            console.log('Marking Check-In...');
            const lat = parseFloat(process.env.OFFICE_LAT || '0');
            const lng = parseFloat(process.env.OFFICE_LNG || '0');
            await db.execute(
                `INSERT INTO attendance (user_id, attendance_date, status, check_in_time, latitude, longitude, marked_with_geo)
                 VALUES (?, CURDATE(), 'present', CURTIME(), ?, ?, TRUE)`,
                [userId, lat, lng]
            );
            console.log('Checked In.');
        } else {
            console.log('Already Checked In at:', existing[0].check_in_time);
            if (existing[0].check_out_time) {
                console.log('Already Checked Out at:', existing[0].check_out_time);
                // Reset checkout for testing
                await db.execute('UPDATE attendance SET check_out_time = NULL WHERE id = ?', [existing[0].id]);
                console.log('Reset Check Out.');
            }
        }

        // 3. Try Check Out with arbitrary location (potentially far away)
        // Let's try to mimic the controller logic locally or just call the DB update to see if it works?
        // No, I want to test the *Logic* of distance.

        const OFFICE_LAT = parseFloat(process.env.OFFICE_LAT);
        const OFFICE_LNG = parseFloat(process.env.OFFICE_LNG);
        const MAX_DISTANCE = Math.max(parseFloat(process.env.MAX_DISTANCE || '50'), 5000);

        console.log('Env Config:', { OFFICE_LAT, OFFICE_LNG, MAX_DISTANCE });

        const testLat = OFFICE_LAT + 0.1; // roughly 11km away
        const testLng = OFFICE_LNG + 0.1;

        // Calculate distance logic from geo.js
        const { calculateDistance } = await import('./src/utils/geo.js');
        const dist = calculateDistance(testLat, testLng, OFFICE_LAT, OFFICE_LNG);
        console.log(`Test Distance: ${dist}m`);

        if (dist > MAX_DISTANCE) {
            console.log('FAIL: Distance too far. Checkout would be rejected.');
        } else {
            console.log('SUCCESS: Distance within range.');
        }

        // 4. Try Check Out with EXACT location
        const dist2 = calculateDistance(OFFICE_LAT, OFFICE_LNG, OFFICE_LAT, OFFICE_LNG);
        console.log(`Exact Location Distance: ${dist2}m`);
        if (dist2 > MAX_DISTANCE) {
            console.log('FAIL: Even exact location fails?');
        } else {
            console.log('SUCCESS: Exact location passes.');
        }

    } catch (err) {
        console.error('Error:', err);
    } finally {
        process.exit();
    }
}

reproduce();
