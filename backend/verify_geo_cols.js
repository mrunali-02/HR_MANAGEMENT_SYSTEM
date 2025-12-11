
import db from './src/db/db.js';
import dotenv from 'dotenv';
dotenv.config();

async function checkColumns() {
    try {
        const [rows] = await db.execute("DESCRIBE attendance");
        const cols = rows.map(r => r.Field);
        const required = ['latitude', 'longitude', 'geo_accuracy', 'marked_with_geo'];

        const missing = required.filter(c => !cols.includes(c));

        if (missing.length === 0) {
            console.log('SUCCESS: All geolocation columns present.');
        } else {
            console.error('FAILURE: Missing columns:', missing);
            process.exit(1);
        }
    } catch (error) {
        console.error('Error checking columns:', error);
        process.exit(1);
    } finally {
        process.exit(0);
    }
}

checkColumns();
