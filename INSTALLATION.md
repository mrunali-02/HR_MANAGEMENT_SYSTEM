# Installation and Setup Guide

Follow these steps to install and run the HR Management System.

## Prerequisites

Before you begin, ensure you have the following installed:

1. **Node.js** (version 18 or higher)
   - Download from: https://nodejs.org/
   - Verify installation: `node --version` (should show v18.x or higher)
   - Verify npm: `npm --version`

2. **MySQL** (version 5.7 or higher, or MariaDB 10.2+)
   - Download MySQL: https://dev.mysql.com/downloads/mysql/
   - Or download MariaDB: https://mariadb.org/download/
   - Make sure MySQL service is running

3. **Git** (optional, for cloning repositories)
   - Download from: https://git-scm.com/

## Step-by-Step Installation

### Step 1: Create MySQL Database

1. Open MySQL command line or MySQL Workbench
2. Connect to your MySQL server
3. Create the database:

```sql
CREATE DATABASE hr_management;
```

4. Verify the database was created:

```sql
SHOW DATABASES;
```

You should see `hr_management` in the list.

### Step 2: Backend Setup

1. **Navigate to backend directory:**

```bash
cd backend
```

2. **Install dependencies:**

```bash
npm install
```

This will install all required packages (express, mysql2, bcrypt, etc.)

3. **Create environment file:**

Create a file named `.env` in the `backend` directory. You can copy from `.env.example`:

**Windows (PowerShell):**
```powershell
Copy-Item .env.example .env
```

**Linux/Mac:**
```bash
cp .env.example .env
```

4. **Edit `.env` file:**

Open `.env` in a text editor and update with your database credentials:

```env
DB_HOST=localhost
DB_USER=root
DB_PASS=your_mysql_password
DB_NAME=hr_management
PORT=3001
TOKEN_EXPIRY_HOURS=24
BCRYPT_SALT_ROUNDS=10

# Optional: Set these to create admin during migration
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=your_secure_password
```

**Important:**
- Replace `your_mysql_password` with your actual MySQL root password
- If you leave `ADMIN_EMAIL` and `ADMIN_PASSWORD` empty, no admin will be created during migration
- You can create admin later using the CLI script

5. **Run database migrations:**

```bash
npm run migrate
```

This will:
- Create all necessary tables (employees, profiles, api_tokens)
- Optionally create an admin user if `ADMIN_EMAIL` and `ADMIN_PASSWORD` are set

**Expected output:**
```
Starting database migration...
✓ Created employees table
✓ Created profiles table
✓ Created api_tokens table
✓ Created admin user: admin@example.com
✓ Migration completed successfully!
```

If you didn't set admin credentials, you'll see:
```
⚠ ADMIN_EMAIL and/or ADMIN_PASSWORD not set - no admin user created
```

6. **Start the backend server:**

```bash
npm run dev
```

**Expected output:**
```
Server running on port 3001
Health check: http://localhost:3001/health
```

The backend is now running! Keep this terminal open.

### Step 3: Frontend Setup

Open a **new terminal window** (keep the backend running in the first terminal).

1. **Navigate to frontend directory:**

```bash
cd frontend
```

2. **Install dependencies:**

```bash
npm install
```

This will install React, Vite, and all frontend dependencies.

3. **Create environment file (optional):**

The frontend will work with defaults, but you can create `.env` if you need to change the API URL:

```env
VITE_API_BASE_URL=http://localhost:3001/api
```

4. **Start the frontend development server:**

```bash
npm run dev
```

**Expected output:**
```
  VITE v5.x.x  ready in xxx ms

  ➜  Local:   http://localhost:3000/
  ➜  Network: use --host to expose
```

The frontend is now running!

### Step 4: Access the Application

1. **Open your web browser** and navigate to:
   ```
   http://localhost:3000
   ```

2. **You should see the login page**

## First-Time Login

### If Admin Was Created During Migration:

1. Go to: `http://localhost:3000/login`
2. Enter the email and password you set in `ADMIN_EMAIL` and `ADMIN_PASSWORD`
3. You'll be redirected to the Admin Dashboard

### If Admin Was NOT Created:

You need to create an admin user first. Choose one method:

#### Option A: Using CLI Script (Recommended)

1. Make sure `ADMIN_EMAIL` and `ADMIN_PASSWORD` are set in `backend/.env`
2. Run:

```bash
cd backend
node scripts/create-admin.js
```

3. You should see: `✓ Admin created successfully: admin@example.com`
4. Now login at `http://localhost:3000/login`

#### Option B: Manual SQL

1. Generate a bcrypt hash for your password (you can use an online tool or Node.js)
2. Run this SQL in MySQL:

```sql
INSERT INTO employees (email, password_hash, role, name)
VALUES ('admin@example.com', '<bcrypt_hash_here>', 'admin', 'Administrator');

-- Get the admin ID
SET @admin_id = LAST_INSERT_ID();

-- Create profile
INSERT INTO profiles (user_id, display_name)
VALUES (@admin_id, 'Administrator');
```

## Creating Employees

1. **Login as admin** at `http://localhost:3000/login`
2. **Click "Add Employee"** button
3. **Fill in the form:**
   - Email
   - Password
   - Name (optional)
   - Role (select from dropdown: Employee, Manager, or HR)
4. **Click "Create Employee"**
5. The employee can now login at `http://localhost:3000/login`

## Troubleshooting

### Backend Issues

**Problem: Cannot connect to database**
- Verify MySQL is running: `mysql -u root -p`
- Check `.env` file has correct credentials
- Verify database exists: `SHOW DATABASES;`

**Problem: Port 3001 already in use**
- Change `PORT` in `backend/.env` to a different port (e.g., 3002)
- Update frontend `.env` if you changed the port

**Problem: Migration fails**
- Ensure database exists: `CREATE DATABASE hr_management;`
- Check MySQL user has CREATE TABLE permissions
- Verify `.env` file is in `backend/` directory

### Frontend Issues

**Problem: Cannot connect to backend**
- Verify backend is running on port 3001
- Check browser console for errors
- Verify `VITE_API_BASE_URL` in frontend `.env` matches backend port

**Problem: Port 3000 already in use**
- Vite will automatically try the next available port
- Or change port in `frontend/vite.config.js`

**Problem: npm install fails**
- Try deleting `node_modules` and `package-lock.json`, then run `npm install` again
- Check Node.js version: `node --version` (should be >= 18)

### Login Issues

**Problem: "Invalid credentials"**
- Verify you're using the correct email and password
- Check that the user exists in database: `SELECT * FROM employees;`
- If admin doesn't exist, create one using the CLI script

**Problem: Token errors**
- Clear browser localStorage: Open DevTools → Application → Local Storage → Clear
- Try logging in again

## Quick Start Commands Summary

```bash
# Terminal 1: Backend
cd backend
npm install
# Edit .env file with your database credentials
npm run migrate
npm run dev

# Terminal 2: Frontend
cd frontend
npm install
npm run dev

# Open browser: http://localhost:3000
```

## Production Build

### Backend Production:

```bash
cd backend
npm start
```

### Frontend Production:

```bash
cd frontend
npm run build
```

The built files will be in `frontend/dist/`. Serve these files with a web server like nginx or Apache.

## Next Steps

- Read `README.md` for detailed documentation
- Check `TESTING.md` for API testing examples
- Start adding employees through the admin dashboard!

