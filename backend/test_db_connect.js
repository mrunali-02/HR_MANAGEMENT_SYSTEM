
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });

console.log('Testing DB Connection...');
console.log('Host:', process.env.DB_HOST);
console.log('User:', process.env.DB_USER);
console.log('Pass Length:', process.env.DB_PASSWORD ? process.env.DB_PASSWORD.length : 0);

async function testConnection() {
    try {
        const connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: '', // TRYING EMPTY PASSWORD
            database: process.env.DB_NAME || 'hr_db'
        });
        console.log('✅ Connection Successful!');
        await connection.end();
    } catch (error) {
        console.error('❌ Connection Failed:', error.message);
        console.error('Full Error:', error);
    }
}

testConnection();
