
import db from './db/db.js';

async function fix() {
    try {
        console.log('Dropping holidays table if exists...');
        await db.execute('DROP TABLE IF EXISTS holidays');

        console.log('Creating holidays table...');
        await db.execute(`
      CREATE TABLE holidays (
        id INT AUTO_INCREMENT PRIMARY KEY,
        date DATE NOT NULL UNIQUE,
        name VARCHAR(255) NOT NULL,
        created_by INT,
        type VARCHAR(50) DEFAULT 'public',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (created_by) REFERENCES employees(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
        console.log('✓ Created holidays table successfully');

        // Test insertion
        console.log('Testing insertion...');
        const [admins] = await db.execute("SELECT id FROM employees WHERE role='admin' LIMIT 1");
        const userId = admins.length > 0 ? admins[0].id : null;
        if (userId) {
            await db.execute(
                'INSERT INTO holidays (date, name, type, created_by) VALUES (?, ?, ?, ?)',
                ['2025-12-31', 'Test Holiday Wrapper', 'public', userId]
            );
            console.log('✓ Insertion successful');
            await db.execute("DELETE FROM holidays WHERE name='Test Holiday Wrapper'");
        } else {
            console.log('Skipping insertion test (no admin found)');
        }

    } catch (err) {
        console.error('Fix failed:', err);
    } finally {
        process.exit();
    }
}

fix();
