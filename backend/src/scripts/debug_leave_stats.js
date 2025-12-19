import db from '../db/db.js';
import fs from 'fs';

async function debugStats() {
  try {
    const currentYear = new Date().getFullYear();
    let output = '';
    const log = (msg) => { console.log(msg); output += (typeof msg === 'object' ? JSON.stringify(msg, null, 2) : msg) + '\n'; };

    log(`Checking stats for year: ${currentYear}`);

    // Check all requests first
    const [all] = await db.execute('SELECT id, type, start_date, end_date, status FROM leave_requests');
    // Check distinct types
    const [types] = await db.execute('SELECT DISTINCT type FROM leave_requests');
    log('Distinct Types found: ' + JSON.stringify(types.map(t => t.type)));

    // Check all PAID requests specifically
    const [paid] = await db.execute("SELECT * FROM leave_requests WHERE type = 'paid'");
    log('\n--- PAID (Planned) Leaves ---');
    if (paid.length === 0) log('No PAID leaves found.');
    paid.forEach(r => {
      const days = (new Date(r.end_date) - new Date(r.start_date)) / (1000 * 60 * 60 * 24) + 1;
      log(`[${r.id}] Status: ${r.status} | ${r.start_date} to ${r.end_date} (${days} days)`);
    });

    // Run the stats query again
    const [stats] = await db.execute(`
      SELECT 
        type,
        SUM(DATEDIFF(end_date, start_date) + 1) as count
      FROM leave_requests
      WHERE (YEAR(start_date) = ? OR YEAR(end_date) = ?)
        AND status = 'approved'
      GROUP BY type
    `, [currentYear, currentYear]);

    log('\nQuery Result (Approved Only):');
    log(stats);

    fs.writeFileSync('debug_output.txt', output);
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

debugStats();
