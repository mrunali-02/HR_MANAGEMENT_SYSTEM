# Troubleshooting Guide

This guide helps you diagnose and fix common login and connection issues.

## Common Login Errors

### 1. "Invalid credentials" Error

**Possible Causes:**
- Wrong email or password
- User doesn't exist in database
- Password hash mismatch

**Solutions:**
1. Verify user exists in database:
   ```sql
   SELECT * FROM employees WHERE email = 'your-email@example.com';
   ```

2. Check if admin exists:
   ```sql
   SELECT * FROM employees WHERE role = 'admin';
   ```

3. If admin doesn't exist, create one:
   ```bash
   cd backend
   # Set ADMIN_EMAIL and ADMIN_PASSWORD in .env
   node scripts/create-admin.js
   ```

4. For testing, verify password hash:
   ```sql
   SELECT email, password_hash FROM employees WHERE email = 'your-email@example.com';
   ```

### 2. "Login failed" or Network Error

**Possible Causes:**
- Backend server not running
- CORS issues
- Wrong API URL
- Database connection failed

**Solutions:**

1. **Check backend is running:**
   ```bash
   # In backend directory
   npm run dev
   ```
   Should see: `Server running on port 3001`

2. **Test backend health:**
   ```bash
   curl http://localhost:3001/health
   ```
   Should return: `{"status":"ok","message":"HR Management API is running"}`

3. **Check database connection:**
   - Verify MySQL is running
   - Check `.env` file has correct credentials
   - Test connection:
     ```bash
     mysql -u root -p
     USE hr_management;
     SHOW TABLES;
     ```

4. **Check frontend API URL:**
   - Open browser DevTools → Console
   - Look for network errors
   - Verify `VITE_API_BASE_URL` in `frontend/.env` matches backend port

5. **Check CORS:**
   - Backend should have `app.use(cors())` in `server.js`
   - Verify backend allows requests from `http://localhost:3000`

### 3. "Token expired" or "Invalid token"

**Possible Causes:**
- Token expired (default 24 hours)
- Token deleted from database
- Token not being sent correctly

**Solutions:**

1. **Clear browser storage:**
   - Open DevTools → Application → Local Storage
   - Delete `token` and `user` entries
   - Try logging in again

2. **Check token expiry:**
   ```sql
   SELECT token, expires_at, UTC_TIMESTAMP() as now 
   FROM api_tokens 
   WHERE user_id = YOUR_USER_ID;
   ```

3. **Verify token is being sent:**
   - Open DevTools → Network tab
   - Check request headers include: `Authorization: Bearer <token>`

### 4. "Cannot connect to backend" or CORS Error

**Possible Causes:**
- Backend not running
- Wrong port
- CORS configuration issue

**Solutions:**

1. **Verify backend is running on correct port:**
   ```bash
   # Check backend .env
   PORT=3001
   ```

2. **Check frontend proxy configuration:**
   - `frontend/vite.config.js` should proxy `/api` to `http://localhost:3001`

3. **Test API directly:**
   ```bash
   curl -X POST http://localhost:3001/api/login \
     -H "Content-Type: application/json" \
     -d '{"email":"test@example.com","password":"test"}'
   ```

4. **Check browser console for errors:**
   - Open DevTools → Console
   - Look for CORS or network errors

### 5. Database Connection Errors

**Error:** `ER_ACCESS_DENIED_ERROR` or `ECONNREFUSED`

**Solutions:**

1. **Verify MySQL is running:**
   ```bash
   # Windows
   net start MySQL
   
   # Linux/Mac
   sudo systemctl start mysql
   # or
   sudo service mysql start
   ```

2. **Check database credentials in `.env`:**
   ```env
   DB_HOST=localhost
   DB_USER=root
   DB_PASS=your_password
   DB_NAME=hr_management
   ```

3. **Test MySQL connection:**
   ```bash
   mysql -u root -p
   ```
   Enter password, then:
   ```sql
   SHOW DATABASES;
   USE hr_management;
   SHOW TABLES;
   ```

4. **Create database if missing:**
   ```sql
   CREATE DATABASE hr_management;
   ```

5. **Run migrations:**
   ```bash
   cd backend
   npm run migrate
   ```

### 6. Migration Errors

**Error:** `Table already exists` or `Cannot create table`

**Solutions:**

1. **Drop and recreate database (WARNING: Deletes all data):**
   ```sql
   DROP DATABASE hr_management;
   CREATE DATABASE hr_management;
   ```

2. **Or drop specific tables:**
   ```sql
   USE hr_management;
   DROP TABLE IF EXISTS api_tokens;
   DROP TABLE IF EXISTS profiles;
   DROP TABLE IF EXISTS employees;
   ```

3. **Then run migrations:**
   ```bash
   npm run migrate
   ```

### 7. Frontend Build/Start Errors

**Error:** `Cannot find module` or `Port already in use`

**Solutions:**

1. **Reinstall dependencies:**
   ```bash
   cd frontend
   rm -rf node_modules package-lock.json
   npm install
   ```

2. **Change port if 3000 is in use:**
   - Edit `frontend/vite.config.js`:
     ```js
     server: {
       port: 3002, // Change to available port
     }
     ```

3. **Check Node.js version:**
   ```bash
   node --version
   ```
   Should be >= 18

### 8. Admin Login Not Working

**Symptoms:** Admin credentials don't work, even though admin was created

**Solutions:**

1. **Verify admin exists:**
   ```sql
   SELECT id, email, role FROM employees WHERE role = 'admin';
   ```

2. **Check password hash:**
   - If you manually created admin, password might not be hashed correctly
   - Use the CLI script instead:
     ```bash
     cd backend
     node scripts/create-admin.js
     ```

3. **Reset admin password:**
   - Delete existing admin:
     ```sql
     DELETE FROM employees WHERE role = 'admin';
     ```
   - Create new admin using CLI script

### 9. Employee Login Redirects to Wrong Page

**Symptoms:** Login works but redirects incorrectly

**Solutions:**

1. **Check user role in database:**
   ```sql
   SELECT id, email, role FROM employees WHERE email = 'employee@example.com';
   ```

2. **Verify redirect logic in `Login.jsx`:**
   - Employee → `/employee/:id`
   - Manager → `/manager/:id`
   - HR → `/hr/:id`
   - Admin → `/admin/dashboard`

3. **Check browser console for errors**

## Debugging Steps

### Step 1: Check Backend Logs

```bash
cd backend
npm run dev
```

Look for:
- Database connection errors
- Route not found errors
- Authentication errors

### Step 2: Check Frontend Console

1. Open browser DevTools (F12)
2. Go to Console tab
3. Look for:
   - Network errors
   - JavaScript errors
   - API response errors

### Step 3: Check Network Requests

1. Open DevTools → Network tab
2. Try logging in
3. Check the login request:
   - Status code (should be 200)
   - Response body (should contain `token` and `user`)
   - Request URL (should be correct)

### Step 4: Verify Database State

```sql
-- Check users
SELECT id, email, role, name FROM employees;

-- Check tokens
SELECT user_id, token, expires_at FROM api_tokens;

-- Check profiles
SELECT user_id, display_name FROM profiles;
```

### Step 5: Test API Directly

```bash
# Test login endpoint
curl -X POST http://localhost:3001/api/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"your_password"}'

# Test admin login
curl -X POST http://localhost:3001/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"your_password"}'
```

## Quick Fixes

### Reset Everything

```bash
# 1. Stop all servers (Ctrl+C)

# 2. Reset database
mysql -u root -p
DROP DATABASE hr_management;
CREATE DATABASE hr_management;
exit

# 3. Run migrations
cd backend
npm run migrate

# 4. Start backend
npm run dev

# 5. Start frontend (new terminal)
cd frontend
npm run dev
```

### Clear Browser Cache

1. Open DevTools (F12)
2. Right-click refresh button
3. Select "Empty Cache and Hard Reload"
4. Or clear localStorage:
   - Application → Local Storage → Clear

## Still Having Issues?

1. **Check error messages carefully** - they often point to the exact issue
2. **Verify all prerequisites** - Node.js, MySQL, npm versions
3. **Check file permissions** - ensure `.env` files are readable
4. **Review logs** - both backend console and browser console
5. **Test with curl** - isolate frontend vs backend issues

## Common Configuration Mistakes

1. **Wrong database name** - Should be `hr_management`
2. **Wrong port** - Backend 3001, Frontend 3000
3. **Missing .env file** - Copy from `.env.example`
4. **Wrong API URL** - Should be `http://localhost:3001/api`
5. **MySQL not running** - Start MySQL service
6. **Tables not created** - Run `npm run migrate`

