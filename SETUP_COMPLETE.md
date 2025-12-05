# Complete Setup Guide - Fix "Invalid Credentials" Error

This guide will help you set up the entire project correctly and fix the "Invalid credentials" error.

## Step-by-Step Complete Setup

### Step 1: Verify Prerequisites

```bash
# Check Node.js version (should be >= 18)
node --version

# Check npm version
npm --version

# Check MySQL is running
mysql --version
```

### Step 2: Create MySQL Database

```bash
# Connect to MySQL
mysql -u root -p

# Run these commands in MySQL:
CREATE DATABASE IF NOT EXISTS hr_management;
SHOW DATABASES;  # Verify hr_management exists
exit;
```

### Step 3: Backend Setup

```bash
cd backend

# Install dependencies
npm install

# Create .env file (copy from .env.example)
# Windows PowerShell:
Copy-Item .env.example .env

# Linux/Mac:
# cp .env.example .env
```

**Edit `backend/.env` file:**

```env
DB_HOST=localhost
DB_USER=root
DB_PASS=your_mysql_password_here
DB_NAME=hr_management
PORT=3001
TOKEN_EXPIRY_HOURS=24
BCRYPT_SALT_ROUNDS=10

# IMPORTANT: Set these to create admin during migration
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=admin123
```

**Replace:**
- `your_mysql_password_here` with your actual MySQL root password
- `admin@example.com` with your desired admin email
- `admin123` with your desired admin password

### Step 4: Run Database Migration

```bash
cd backend
npm run migrate
```

**Expected output:**
```
Starting database migration...
✓ Created employees table
✓ Created profiles table
✓ Created api_tokens table
✓ Created admin user: admin@example.com
✓ Migration completed successfully!
```

### Step 5: Verify Database Setup

```bash
cd backend
node scripts/setup-database.js
```

This will show:
- Database connection status
- Tables created
- Admin user created
- All users in database

### Step 6: Start Backend Server

```bash
cd backend
npm run dev
```

**Expected output:**
```
Server running on port 3001
Health check: http://localhost:3001/health
```

**Test backend:**
```bash
# In another terminal
curl http://localhost:3001/health
```

Should return: `{"status":"ok","message":"HR Management API is running"}`

### Step 7: Frontend Setup

```bash
# Open new terminal
cd frontend

# Install dependencies
npm install

# Create .env file (optional)
# Windows PowerShell:
echo "VITE_API_BASE_URL=http://localhost:3001/api" > .env

# Linux/Mac:
# echo "VITE_API_BASE_URL=http://localhost:3001/api" > .env
```

### Step 8: Start Frontend Server

```bash
cd frontend
npm run dev
```

**Expected output:**
```
  VITE v5.x.x  ready in xxx ms

  ➜  Local:   http://localhost:3000/
```

### Step 9: Test Login

1. **Open browser:** `http://localhost:3000`

2. **Admin Login:**
   - Go to: `http://localhost:3000/login`
   - Email: `admin@example.com` (or what you set in .env)
   - Password: `admin123` (or what you set in .env)
   - Click "Sign in"

3. **If login fails, check:**

   **a) Verify admin exists in database:**
   ```bash
   mysql -u root -p
   USE hr_management;
   SELECT id, email, role FROM employees WHERE role = 'admin';
   ```

   **b) Check backend logs:**
   - Look at the terminal where backend is running
   - You should see: `Admin login attempt for email: ...`
   - Check for error messages

   **c) Test API directly:**
   ```bash
   curl -X POST http://localhost:3001/api/admin/login \
     -H "Content-Type: application/json" \
     -d "{\"email\":\"admin@example.com\",\"password\":\"admin123\"}"
   ```

## Common Issues and Solutions

### Issue 1: "Invalid credentials" - Admin doesn't exist

**Solution:**
```bash
cd backend
# Make sure ADMIN_EMAIL and ADMIN_PASSWORD are set in .env
node scripts/create-admin.js
```

### Issue 2: "Invalid credentials" - Wrong password

**Solution:**
1. Check `.env` file has correct `ADMIN_PASSWORD`
2. Make sure you're using the exact password from `.env`
3. Check for extra spaces in `.env` file

### Issue 3: Database connection failed

**Solution:**
1. Verify MySQL is running:
   ```bash
   # Windows
   net start MySQL
   
   # Linux/Mac
   sudo systemctl start mysql
   ```

2. Check `.env` credentials:
   ```env
   DB_HOST=localhost
   DB_USER=root
   DB_PASS=your_actual_password
   DB_NAME=hr_management
   ```

3. Test MySQL connection:
   ```bash
   mysql -u root -p
   # Enter password, then:
   USE hr_management;
   SHOW TABLES;
   ```

### Issue 4: Tables don't exist

**Solution:**
```bash
cd backend
npm run migrate
```

### Issue 5: Port already in use

**Solution:**
- Backend: Change `PORT` in `backend/.env`
- Frontend: Change port in `frontend/vite.config.js`

## Complete Verification Checklist

- [ ] MySQL is running
- [ ] Database `hr_management` exists
- [ ] Backend `.env` file is configured correctly
- [ ] `npm run migrate` completed successfully
- [ ] Admin user exists in database
- [ ] Backend server starts without errors
- [ ] `curl http://localhost:3001/health` returns OK
- [ ] Frontend server starts without errors
- [ ] Can access `http://localhost:3000`
- [ ] Admin login works

## Quick Test Script

Save this as `test-setup.sh` (Linux/Mac) or `test-setup.ps1` (Windows):

**Linux/Mac (`test-setup.sh`):**
```bash
#!/bin/bash

echo "Testing backend..."
curl -s http://localhost:3001/health || echo "Backend not running!"

echo -e "\nTesting admin login..."
curl -X POST http://localhost:3001/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"admin123"}' \
  | jq . || echo "Login failed!"
```

**Windows PowerShell (`test-setup.ps1`):**
```powershell
Write-Host "Testing backend..."
Invoke-WebRequest -Uri http://localhost:3001/health -UseBasicParsing

Write-Host "`nTesting admin login..."
$body = @{
    email = "admin@example.com"
    password = "admin123"
} | ConvertTo-Json

Invoke-RestMethod -Uri http://localhost:3001/api/admin/login `
    -Method POST `
    -ContentType "application/json" `
    -Body $body
```

## Creating Employees After Login

1. Login as admin at `/login`
2. Click "Add Employee" button
3. Fill in:
   - Email: `employee@example.com`
   - Password: `employee123`
   - Name: `John Employee`
   - Role: Select from dropdown (Employee, Manager, or HR)
4. Click "Create Employee"
5. Employee can now login at `/login`

## Database Queries for Debugging

```sql
-- Check all users
SELECT id, email, role, name FROM employees;

-- Check admin specifically
SELECT id, email, role, name FROM employees WHERE role = 'admin';

-- Check tokens
SELECT user_id, token, expires_at FROM api_tokens;

-- Check profiles
SELECT user_id, display_name FROM profiles;

-- Delete a user (if needed)
DELETE FROM api_tokens WHERE user_id = 1;
DELETE FROM profiles WHERE user_id = 1;
DELETE FROM employees WHERE id = 1;
```

## Still Having Issues?

1. **Check backend console** - Look for error messages
2. **Check browser console** - F12 → Console tab
3. **Check browser Network tab** - F12 → Network → Look for failed requests
4. **Run setup verification:**
   ```bash
   cd backend
   node scripts/setup-database.js
   ```
5. **Review TROUBLESHOOTING.md** for detailed solutions

## Success Indicators

You'll know everything is working when:
- ✅ Backend health check returns OK
- ✅ Admin login redirects to `/admin/dashboard`
- ✅ Admin can see user list
- ✅ Admin can add employees
- ✅ Employees can login and see their dashboard
- ✅ No errors in browser console
- ✅ No errors in backend console

