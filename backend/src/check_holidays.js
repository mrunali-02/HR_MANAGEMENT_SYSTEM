import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

async function checkHolidays() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASS || '',
        database: process.env.DB_NAME || 'hr_management'
    });

    const [rows] = await connection.execute('SELECT * FROM holidays WHERE date LIKE "2026-01-01%"');
    console.log('Holidays for 2026-01-01:', rows);

    const [all] = await connection.execute('SELECT count(*) as count FROM holidays');
    console.log('Total holidays:', all[0].count);

    await connection.end();
}

checkHolidays();
