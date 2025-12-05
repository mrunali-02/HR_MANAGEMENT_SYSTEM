import db from '../src/db/db.js';
import { hashPassword } from '../src/utils/hash.js';
import dotenv from 'dotenv';

dotenv.config();

async function setupDatabase() {
  try {
    console.log('Testing database connection...');
    
    // Test connection
    const [result] = await db.execute('SELECT 1 as test');
    console.log('✓ Database connection successful');

    // Check if database exists
    const [databases] = await db.execute('SHOW DATABASES LIKE ?', [process.env.DB_NAME || 'hr_management']);
    if (databases.length === 0) {
      console.log(`⚠ Database '${process.env.DB_NAME || 'hr_management'}' does not exist`);
      console.log('  Please create it first: CREATE DATABASE hr_management;');
      process.exit(1);
    }
    console.log(`✓ Database '${process.env.DB_NAME || 'hr_management'}' exists`);

    // Check tables
    const [tables] = await db.execute('SHOW TABLES');
    console.log(`✓ Found ${tables.length} tables in database`);

    // Check for admin user
    const [admins] = await db.execute(
      'SELECT id, email, role FROM employees WHERE role = ?',
      ['admin']
    );

    if (admins.length === 0) {
      console.log('⚠ No admin user found');
      const adminEmail = process.env.ADMIN_EMAIL?.trim();
      const adminPassword = process.env.ADMIN_PASSWORD?.trim();
      
      if (adminEmail && adminPassword) {
        console.log(`Creating admin user: ${adminEmail}`);
        const passwordHash = await hashPassword(adminPassword);
        const [result] = await db.execute(
          'INSERT INTO employees (email, password_hash, role, name) VALUES (?, ?, ?, ?)',
          [adminEmail, passwordHash, 'admin', 'Administrator']
        );
        
        const adminId = result.insertId;
        await db.execute(
          'INSERT INTO profiles (user_id, display_name) VALUES (?, ?)',
          [adminId, 'Administrator']
        );
        
        console.log(`✓ Admin created successfully with ID: ${adminId}`);
      } else {
        console.log('  Set ADMIN_EMAIL and ADMIN_PASSWORD in .env to create admin');
      }
    } else {
      console.log(`✓ Found ${admins.length} admin user(s):`);
      admins.forEach(admin => {
        console.log(`  - ${admin.email} (ID: ${admin.id})`);
      });
    }

    // List all users
    const [users] = await db.execute(
      'SELECT id, email, role, name FROM employees ORDER BY id'
    );
    
    if (users.length > 0) {
      console.log(`\nAll users in database (${users.length} total):`);
      users.forEach(user => {
        console.log(`  - ${user.email} (${user.role}) - ${user.name || 'No name'}`);
      });
    }

    console.log('\n✓ Database setup check completed');
  } catch (error) {
    console.error('✗ Database setup error:', error.message);
    console.error('Full error:', error);
    process.exit(1);
  } finally {
    await db.end();
  }
}

setupDatabase();

