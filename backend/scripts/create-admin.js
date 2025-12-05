import db from '../src/db/db.js';
import { hashPassword } from '../src/utils/hash.js';
import dotenv from 'dotenv';

dotenv.config();

async function createAdmin() {
  const adminEmail = process.env.ADMIN_EMAIL?.trim();
  const adminPassword = process.env.ADMIN_PASSWORD?.trim();

  if (!adminEmail || !adminPassword) {
    console.error('Error: ADMIN_EMAIL and ADMIN_PASSWORD must be set in .env file');
    process.exit(1);
  }

  try {
    // Check if admin already exists
    const [existing] = await db.execute(
      'SELECT id FROM employees WHERE email = ? AND role = ?',
      [adminEmail, 'admin']
    );

    if (existing.length > 0) {
      console.log(`Admin with email ${adminEmail} already exists`);
      await db.end();
      process.exit(0);
    }

    const passwordHash = await hashPassword(adminPassword);
    await db.execute(
      'INSERT INTO employees (email, password_hash, role, name) VALUES (?, ?, ?, ?)',
      [adminEmail, passwordHash, 'admin', 'Administrator']
    );

    const [admin] = await db.execute(
      'SELECT id FROM employees WHERE email = ?',
      [adminEmail]
    );

    // Create profile for admin
    await db.execute(
      'INSERT INTO profiles (user_id, display_name) VALUES (?, ?)',
      [admin[0].id, 'Administrator']
    );

    console.log(`✓ Admin created successfully: ${adminEmail}`);
  } catch (error) {
    console.error('Error creating admin:', error);
    process.exit(1);
  } finally {
    await db.end();
  }
}

createAdmin();

