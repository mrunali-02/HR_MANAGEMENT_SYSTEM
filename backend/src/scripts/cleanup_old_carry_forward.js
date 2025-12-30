// Cleanup script to remove carry forward data from 2024 and earlier
import db from '../db/db.js';

async function cleanupOldCarryForward() {
    try {
        console.log('🧹 Starting cleanup of carry forward data from 2024 and earlier...');

        // First, check what data exists
        const [existingData] = await db.execute(`
            SELECT year, COUNT(*) as count, SUM(carried_forward) as total_carried
            FROM leave_balances 
            WHERE year <= 2024 AND carried_forward > 0
            GROUP BY year
            ORDER BY year DESC
        `);

        if (existingData.length === 0) {
            console.log('✅ No carry forward data found for 2024 or earlier. Nothing to clean up.');
            process.exit(0);
        }

        console.log('\n📊 Existing carry forward data (2024 and earlier):');
        existingData.forEach(row => {
            console.log(`   Year ${row.year}: ${row.count} records, ${row.total_carried} days carried forward`);
        });

        // Delete carry forward data from 2024 and earlier
        // Option 1: Delete entire records (if they only contain carry forward data)
        // Option 2: Reset carried_forward to 0 and recalculate total_days

        // Using Option 2 - safer, preserves other data
        const [updateResult] = await db.execute(`
            UPDATE leave_balances 
            SET carried_forward = 0,
                total_days = total_days - carried_forward,
                remaining_days = remaining_days - carried_forward
            WHERE year <= 2024 AND carried_forward > 0
        `);

        console.log(`\n✅ Cleanup completed successfully!`);
        console.log(`   Updated ${updateResult.affectedRows} records`);
        console.log(`   All carry forward data from 2024 and earlier has been removed.`);
        console.log(`\n📌 The system is now configured to start from 2025.`);

        // Verify cleanup
        const [verifyData] = await db.execute(`
            SELECT COUNT(*) as count
            FROM leave_balances 
            WHERE year <= 2024 AND carried_forward > 0
        `);

        if (verifyData[0].count === 0) {
            console.log('\n✓ Verification successful: No carry forward data remains for 2024 or earlier.');
        } else {
            console.log(`\n⚠ Warning: ${verifyData[0].count} records still have carry forward data.`);
        }

        process.exit(0);

    } catch (error) {
        console.error('❌ Error during cleanup:', error);
        process.exit(1);
    }
}

cleanupOldCarryForward();
