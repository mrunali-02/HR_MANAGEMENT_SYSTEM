import db from '../db/db.js';
import { hashPassword } from '../utils/hash.js';
import dotenv from 'dotenv';

dotenv.config();

async function migrate() {
  let connection;

  try {
    connection = await db.getConnection();

    console.log('Starting database migration...');

    // Create employees table
    await connection.execute(
      `CREATE TABLE IF NOT EXISTS employees (
        id INT AUTO_INCREMENT PRIMARY KEY,
        employee_id VARCHAR(50) UNIQUE,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        name VARCHAR(255),
        role ENUM('admin', 'employee', 'manager', 'hr') NOT NULL DEFAULT 'employee',
        manager_id INT,
        department VARCHAR(255),
        phone VARCHAR(50),
        joined_on DATE,
        photo_url VARCHAR(500),
        address TEXT,
        joined_on DATE,
        photo_url VARCHAR(500),
        address TEXT,
        status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_email (email),

        INDEX idx_role (role),
        INDEX idx_manager_id (manager_id),
        FOREIGN KEY (manager_id) REFERENCES employees(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    console.log('✓ Created employees table');

    // Migration update: Add status column if not exists
    try {
      await connection.execute(`
        SELECT count(*) FROM information_schema.COLUMNS 
        WHERE (TABLE_SCHEMA = '${process.env.DB_NAME || 'hr_db'}' AND TABLE_NAME = 'employees' AND COLUMN_NAME = 'status')
      `).then(async ([rows]) => {
        if (rows[0]['count(*)'] === 0) {
          await connection.execute("ALTER TABLE employees ADD COLUMN status ENUM('active', 'inactive') NOT NULL DEFAULT 'active'");
          console.log('✓ Added status column to employees');
        }
      });

      // Optional: Drop contact_number if exists (ignoring for safety usually, but user asked to remove)
      // For now, let's just add status to be safe and ensure the UI uses it.
    } catch (err) {
      console.log('Note: Column migration check failed or already exists', err.message);
    }


    // Create profiles table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS profiles (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        display_name VARCHAR(255),
        bio TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES employees(id) ON DELETE CASCADE,
        UNIQUE KEY unique_user_id (user_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    console.log('✓ Created profiles table');

    // Create api_tokens table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS api_tokens (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        token VARCHAR(255) UNIQUE NOT NULL,
        expires_at DATETIME NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES employees(id) ON DELETE CASCADE,
        INDEX idx_token (token),
        INDEX idx_user_id (user_id),
        INDEX idx_expires_at (expires_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    console.log('✓ Created api_tokens table');

    // Create roles table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS roles (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) UNIQUE NOT NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    console.log('✓ Created roles table');

    // Create departments table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS departments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(150) UNIQUE NOT NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    console.log('✓ Created departments table');

    // Create holidays table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS holidays (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        holiday_date DATE NOT NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY unique_holiday (holiday_date)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    console.log('✓ Created holidays table');

    // Create leave policies table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS leave_policies (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        type ENUM('sick', 'casual', 'paid', 'emergency') NOT NULL,
        total_days INT NOT NULL DEFAULT 05,
        carry_forward TINYINT(1) NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    console.log('✓ Created leave_policies table');
    // Seed default leave policies if empty
    const [lpCountRows] = await connection.execute(
      'SELECT COUNT(*) AS cnt FROM leave_policies'
    );

    if (lpCountRows[0].cnt === 0) {
      await connection.execute(`
    INSERT INTO leave_policies (name, type, total_days, carry_forward)
    VALUES
      ('Sick Leave',     'sick',     5, 0),
      ('Casual Leave',   'casual',   3, 0),
      ('Paid Leave',     'paid',    2, 0),
      ('Emergency Leave','emergency',3, 0)
  `);
      console.log('✓ Seeded default leave policies');
    } else {
      console.log('⚠ leave_policies already has data, skipping seed');
    }


    // Create attendance table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS attendance (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        attendance_date DATE NOT NULL,
        status ENUM('present', 'absent', 'remote', 'leave') NOT NULL DEFAULT 'present',
        check_in_time TIME,
        check_out_time TIME,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY unique_attendance (user_id, attendance_date),
        FOREIGN KEY (user_id) REFERENCES employees(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    console.log('✓ Created attendance table');

    // Create attendance corrections table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS attendance_corrections (
        id INT AUTO_INCREMENT PRIMARY KEY,
        attendance_id INT NOT NULL,
        user_id INT NOT NULL,
        correction_type VARCHAR(100) NOT NULL,
        reason TEXT NOT NULL,
        status ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
        reviewed_by INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (attendance_id) REFERENCES attendance(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES employees(id) ON DELETE CASCADE,
        FOREIGN KEY (reviewed_by) REFERENCES employees(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    console.log('✓ Created attendance_corrections table');

    // Create leave requests table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS leave_requests (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        type ENUM('sick', 'casual', 'paid', 'emergency') NOT NULL,
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        reason TEXT,
        status ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
        reviewed_by INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES employees(id) ON DELETE CASCADE,
        FOREIGN KEY (reviewed_by) REFERENCES employees(id) ON DELETE SET NULL,
        INDEX idx_leave_user (user_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    console.log('✓ Created leave_requests table');

    // Create leave balances table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS leave_balances (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        leave_type ENUM('sick', 'casual', 'paid', 'emergency') NOT NULL,
        total_days INT NOT NULL DEFAULT 05,
        used_days INT NOT NULL DEFAULT 0,
        remaining_days INT NOT NULL DEFAULT 0,
        year INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES employees(id) ON DELETE CASCADE,
        UNIQUE KEY unique_user_leave_year (user_id, leave_type, year),
        INDEX idx_user_year (user_id, year)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    console.log('✓ Created leave_balances table');

    // Create work_hours table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS work_hours (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        attendance_id INT NOT NULL,
        work_date DATE NOT NULL,
        check_in_time TIME NOT NULL,
        check_out_time TIME NOT NULL,
        total_hours DECIMAL(5,2) NOT NULL DEFAULT 0,
        overtime_hours DECIMAL(5,2) NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES employees(id) ON DELETE CASCADE,
        FOREIGN KEY (attendance_id) REFERENCES attendance(id) ON DELETE CASCADE,
        UNIQUE KEY unique_attendance_work_hours (attendance_id),
        INDEX idx_user_date (user_id, work_date),
        INDEX idx_work_date (work_date)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    console.log('✓ Created work_hours table');

    // Create overtime table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS overtimes (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        work_date DATE NOT NULL,
        hours DECIMAL(5,2) NOT NULL DEFAULT 0,
        description TEXT,
        status ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES employees(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    console.log('✓ Created overtimes table');

    // Create audit logs table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT,
        action VARCHAR(255) NOT NULL,
        metadata TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES employees(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    console.log('✓ Created audit_logs table');

    // Create failed logins table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS failed_logins (
        id INT AUTO_INCREMENT PRIMARY KEY,
        email VARCHAR(255) NOT NULL,
        ip_address VARCHAR(100),
        user_agent VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_failed_email (email)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    console.log('✓ Created failed_logins table');

    // Create notifications table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS notifications (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        message TEXT NOT NULL,
        is_read TINYINT(1) NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES employees(id) ON DELETE CASCADE,
        INDEX idx_notifications_user (user_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    console.log('✓ Created notifications table');

    // Create admin notes table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS admin_notes (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        content TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES employees(id) ON DELETE CASCADE,
        INDEX idx_admin_notes_user (user_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    console.log('✓ Created admin_notes table');

    // Create settings table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS settings (
        id INT AUTO_INCREMENT PRIMARY KEY,
        category VARCHAR(50) UNIQUE NOT NULL,
        value JSON NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    console.log('✓ Created settings table');

    // Create admin if ADMIN_EMAIL and ADMIN_PASSWORD are set
    const adminEmail = process.env.ADMIN_EMAIL?.trim();
    const adminPassword = process.env.ADMIN_PASSWORD?.trim();

    if (adminEmail && adminPassword) {
      // Check if admin already exists
      const [existing] = await connection.execute(
        'SELECT id FROM employees WHERE email = ? AND role = ?',
        [adminEmail, 'admin']
      );

      if (existing.length === 0) {
        const passwordHash = await hashPassword(adminPassword);
        await connection.execute(
          'INSERT INTO employees (email, password_hash, role, name) VALUES (?, ?, ?, ?)',
          [adminEmail, passwordHash, 'admin', 'Administrator']
        );

        const [admin] = await connection.execute(
          'SELECT id FROM employees WHERE email = ?',
          [adminEmail]
        );

        // Create profile for admin
        await connection.execute(
          'INSERT INTO profiles (user_id, display_name) VALUES (?, ?)',
          [admin[0].id, 'Administrator']
        );
        console.log(`✓ Created admin user: ${adminEmail}`);


      } else {
        console.log(`⚠ Admin with email ${adminEmail} already exists, skipping creation`);

      }
    } else {
      console.log('⚠ ADMIN_EMAIL and/or ADMIN_PASSWORD not set - no admin user created');
      console.log('  You can create an admin later using the create-admin script or manually via SQL');
    }

    console.log('\n✓ Migration completed successfully!');
  } catch (error) {
    console.error('✗ Migration failed:', error);
    process.exit(1);
  } finally {
    if (connection) {
      connection.release();
    }
    await db.end();
    process.exit(0);
  }
}

migrate();
