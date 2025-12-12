import db from './src/db/db.js';

async function fixSchema() {
    try {
        console.log('Adding missing columns to employees table...');

        // Check if columns exist first or just try ADD COLUMN (MySQL allows ADD COLUMN IF NOT EXISTS in newer versions, else loop)
        // Simple approach: Try adding each. If error "Duplicate column", ignore.

        const columns = [
            "ADD COLUMN dob DATE NULL",
            "ADD COLUMN gender VARCHAR(20) NULL",
            "ADD COLUMN blood_group VARCHAR(10) NULL",
            "ADD COLUMN nationality VARCHAR(100) NULL",
            "ADD COLUMN emergency_contact VARCHAR(20) NULL"
        ];

        for (const colDef of columns) {
            try {
                await db.execute(`ALTER TABLE employees ${colDef}`);
                console.log(`Executed: ${colDef}`);
            } catch (err) {
                if (err.code === 'ER_DUP_FIELDNAME') {
                    console.log(`Skipped (exists): ${colDef}`);
                } else {
                    console.error(`Failed: ${colDef}`, err.message);
                }
            }
        }

        console.log('Schema update complete.');
        process.exit(0);
    } catch (err) {
        console.error('Fatal error:', err);
        process.exit(1);
    }
}

fixSchema();
