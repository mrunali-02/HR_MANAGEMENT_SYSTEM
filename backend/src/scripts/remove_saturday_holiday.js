import db from '../db/db.js';
import fs from 'fs';

async function removeSaturdayHoliday() {
    try {
        console.log('Fetching holidays...');
        const [holidays] = await db.execute('SELECT * FROM holidays');

        fs.writeFileSync('holidays.json', JSON.stringify(holidays, null, 2));
        console.log('Wrote holidays to holidays.json');

        let found = false;
        for (const holiday of holidays) {
            const date = new Date(holiday.date);
            const day = date.getDay(); // 0 = Sunday, 6 = Saturday

            console.log(`[${holiday.id}] ${holiday.name} - '${holiday.date}'`);

            // "nl holiday" (id 2) is the likely candidate even if it says Friday
            if (holiday.id === 2 || holiday.name === 'nl holiday') {
                console.log(`Found target holiday: ${holiday.name} on ${holiday.date}`);
                await db.execute('DELETE FROM holidays WHERE id = ?', [holiday.id]);
                console.log(`✓ Removed ${holiday.name}`);
                found = true;
            }
        }

        if (!found) {
            console.log('No Saturday holidays found.');
        }

        console.log('Done.');
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

removeSaturdayHoliday();
