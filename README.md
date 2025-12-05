# HR Management System - Complete Setup Guide

## 📋 Table of Contents

1. [Project Overview](#project-overview)
2. [Features](#features)
3. [Tech Stack](#tech-stack)
4. [Prerequisites](#prerequisites)
5. [Installation on New Device](#installation-on-new-device)
6. [Environment Variables](#environment-variables)
7. [Database Setup](#database-setup)
8. [Running the Project](#running-the-project)
9. [API Documentation](#api-documentation)
10. [Project Structure](#project-structure)
11. [User Roles & Workflows](#user-roles--workflows)
12. [Troubleshooting](#troubleshooting)
13. [Security Best Practices](#security-best-practices)
14. [Production Deployment](#production-deployment)

---

## 🎯 Project Overview

This is a complete **HR Management System** built from scratch with modern web technologies. The system provides a comprehensive solution for managing employees, attendance, leave requests, and organizational data.

### Key Highlights

- ✅ **No External Dependencies**: Uses DB-backed token authentication (no Firebase)
- ✅ **Clean Database**: No dummy data - all users created manually by admin
- ✅ **Role-Based Access**: Admin, Employee, Manager, and HR roles
- ✅ **Secure**: bcrypt password hashing, rate limiting, token expiry
- ✅ **Modern UI**: Beautiful, responsive design with animations
- ✅ **Full-Stack**: Complete backend API + React frontend

---

## ✨ Features

### Authentication & Authorization
- Single login page for all roles (Admin, Employee, Manager, HR)
- Token-based authentication with UUID tokens
- Role-based access control (RBAC)
- Secure password hashing with bcrypt
- Rate limiting on login endpoints
- Token expiry management

### Admin Features
- **Dashboard**: Overview statistics and recent activity
- **Employee Management**: Add, edit, delete, and list employees
- **Leave Applications**: View, approve, and reject leave requests
- **Reports**: Analytics and data visualization
- **Settings**: System configuration

### Employee Features
- **Dashboard**: Personal statistics and quick actions
- **Attendance**: Mark attendance and view history
- **Leave Management**: Apply for leave, view balance, and history
- **Profile**: Update personal information
- **Notifications**: View system notifications

### Database Features
- **MySQL Database**: Relational database with proper schema
- **Migrations**: Automated database setup
- **Foreign Keys**: Data integrity enforcement
- **Indexes**: Optimized queries

---

## 🛠 Tech Stack

### Backend
- **Node.js** (>=18) - JavaScript runtime
- **Express.js** - Web framework
- **MySQL** (mysql2/promise) - Database client
- **bcrypt** - Password hashing
- **UUID** - Token generation
- **express-rate-limit** - Rate limiting
- **CORS** - Cross-origin resource sharing
- **dotenv** - Environment variables

### Frontend
- **React 18** - UI library
- **Vite** - Build tool and dev server
- **React Router** - Client-side routing
- **Axios** - HTTP client
- **Tailwind CSS** - Utility-first CSS framework
- **PostCSS** - CSS processing

### Database
- **MySQL** (>=5.7) or **MariaDB** (>=10.2)

---

## 📦 Prerequisites

Before installing, ensure you have the following installed on your system:

### Required Software

1. **Node.js** (>=18.0.0)
   - Download from: https://nodejs.org/
   - Verify: `node --version`
   - Verify npm: `npm --version`

2. **MySQL** (>=5.7) or **MariaDB** (>=10.2)
   - Download MySQL: https://dev.mysql.com/downloads/
   - Download MariaDB: https://mariadb.org/download/
   - Verify: `mysql --version`

3. **Git** (optional, for cloning)
   - Download from: https://git-scm.com/
   - Verify: `git --version`

4. **Code Editor** (recommended: VS Code)
   - Download from: https://code.visualstudio.com/

### System Requirements

- **Operating System**: Windows, macOS, or Linux
- **RAM**: Minimum 4GB (8GB recommended)
- **Disk Space**: At least 500MB free space
- **Internet**: Required for npm package installation

---

## 🚀 Installation on New Device

Follow these steps to set up the project on a completely new device:

### Step 1: Clone or Download the Project

#### Option A: Using Git
```bash
git clone <repository-url>
cd hr-management
```

#### Option B: Download ZIP
1. Download the project ZIP file
2. Extract to your desired location
3. Open terminal/command prompt in the extracted folder

### Step 2: Install MySQL and Create Database

#### Windows
1. Download MySQL Installer from https://dev.mysql.com/downloads/installer/
2. Run installer and follow setup wizard
3. Remember your root password
4. Open MySQL Command Line Client or MySQL Workbench

#### macOS
```bash
# Using Homebrew
brew install mysql
brew services start mysql
```

#### Linux (Ubuntu/Debian)
```bash
sudo apt update
sudo apt install mysql-server
sudo systemctl start mysql
sudo systemctl enable mysql
```

#### Create Database
```sql
-- Open MySQL command line or MySQL Workbench
mysql -u root -p

-- Enter your MySQL root password when prompted

-- Create the database
CREATE DATABASE hr_management CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Verify database creation
SHOW DATABASES;

-- Exit MySQL
EXIT;
```

### Step 3: Backend Setup

```bash
# Navigate to backend directory
cd backend

# Install dependencies
npm install

# This will install all required packages:
# - express
# - mysql2
# - bcrypt
# - uuid
# - dotenv
# - express-rate-limit
# - cors
# - nodemon (dev dependency)
```

### Step 4: Configure Backend Environment Variables

Create a `.env` file in the `backend` directory:

```bash
# Windows (Command Prompt)
copy NUL .env

# Windows (PowerShell)
New-Item -Path .env -ItemType File

# macOS/Linux
touch .env
```

Edit the `.env` file with your database credentials:

```env
# Database Configuration
DB_HOST=localhost
DB_USER=root
DB_PASS=your_mysql_password
DB_NAME=hr_management

# Server Configuration
PORT=3001
NODE_ENV=development

# Security Configuration
BCRYPT_SALT_ROUNDS=10
TOKEN_EXPIRY_HOURS=24

# Admin User Creation (Optional)
# Set these to create admin during migration
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=your_secure_admin_password
```

**Important Notes:**
- Replace `your_mysql_password` with your actual MySQL root password
- Replace `admin@example.com` and `your_secure_admin_password` with your desired admin credentials
- If you don't set `ADMIN_EMAIL` and `ADMIN_PASSWORD`, no admin will be created during migration (you can create one later)

### Step 5: Run Database Migrations

```bash
# Make sure you're in the backend directory
cd backend

# Run migrations
npm run migrate
```

**What this does:**
- Creates all required database tables
- Sets up foreign key relationships
- Creates indexes for performance
- Optionally creates admin user if `ADMIN_EMAIL` and `ADMIN_PASSWORD` are set

**Expected Output:**
```
Starting database migration...
✓ Created employees table
✓ Created profiles table
✓ Created api_tokens table
✓ Created roles table
✓ Created departments table
✓ Created holidays table
✓ Created leave_policies table
✓ Created attendance table
✓ Created attendance_corrections table
✓ Created leave_requests table
✓ Created leave_balances table
✓ Created overtimes table
✓ Created audit_logs table
✓ Created failed_logins table
✓ Created notifications table
Admin user created successfully: admin@example.com
Migration completed successfully!
```

### Step 6: Start Backend Server

```bash
# Development mode (with auto-reload)
npm run dev

# OR Production mode
npm start
```

**Expected Output:**
```
Server running on port 3001
Health check: http://localhost:3001/health
```

**Verify Backend:**
- Open browser: http://localhost:3001/health
- Should see: `{"status":"ok","message":"HR Management API is running"}`

### Step 7: Frontend Setup

Open a **new terminal/command prompt** (keep backend running):

```bash
# Navigate to frontend directory
cd frontend

# Install dependencies
npm install

# This will install all required packages:
# - react
# - react-dom
# - react-router-dom
# - axios
# - vite
# - tailwindcss
# - postcss
# - autoprefixer
```

### Step 8: Configure Frontend Environment Variables (Optional)

Create a `.env` file in the `frontend` directory:

```bash
# Windows (Command Prompt)
copy NUL .env

# Windows (PowerShell)
New-Item -Path .env -ItemType File

# macOS/Linux
touch .env
```

Edit the `.env` file:

```env
# API Base URL (defaults to http://localhost:3001/api if not set)
VITE_API_BASE_URL=http://localhost:3001/api
```

**Note:** If you don't create this file, it will default to `http://localhost:3001/api`

### Step 9: Start Frontend Development Server

```bash
# Make sure you're in the frontend directory
cd frontend

# Start development server
npm run dev
```

**Expected Output:**
```
  VITE v5.x.x  ready in xxx ms

  ➜  Local:   http://localhost:3000/
  ➜  Network: use --host to expose
```

### Step 10: Access the Application

1. Open your browser
2. Navigate to: **http://localhost:3000**
3. You should see the login page
4. Use the admin credentials you set in `ADMIN_EMAIL` and `ADMIN_PASSWORD`

---

## 🔐 Environment Variables

### Backend Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `DB_HOST` | MySQL host address | `localhost` | Yes |
| `DB_USER` | MySQL username | `root` | Yes |
| `DB_PASS` | MySQL password | (empty) | Yes |
| `DB_NAME` | Database name | `hr_management` | Yes |
| `PORT` | Backend server port | `3001` | No |
| `NODE_ENV` | Environment mode | `development` | No |
| `BCRYPT_SALT_ROUNDS` | bcrypt salt rounds | `10` | No |
| `TOKEN_EXPIRY_HOURS` | Token expiry in hours | `24` | No |
| `ADMIN_EMAIL` | Admin email (for auto-creation) | (empty) | No |
| `ADMIN_PASSWORD` | Admin password (for auto-creation) | (empty) | No |

### Frontend Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `VITE_API_BASE_URL` | Backend API base URL | `http://localhost:3001/api` | No |

---

## 🗄 Database Setup

### Database Schema

The migration script creates the following tables:

#### Core Tables
- **employees** - User accounts and employee information
- **profiles** - User profile data (display name, bio)
- **api_tokens** - Authentication tokens

#### Organization Tables
- **roles** - Role definitions
- **departments** - Department information
- **holidays** - Company holidays
- **leave_policies** - Leave policy configurations

#### Operations Tables
- **attendance** - Attendance records
- **attendance_corrections** - Attendance correction requests
- **leave_requests** - Leave applications
- **leave_balances** - Employee leave balances
- **overtimes** - Overtime records

#### Audit & Security Tables
- **audit_logs** - System audit trail
- **failed_logins** - Failed login attempts
- **notifications** - System notifications

### Manual Database Operations

#### Create Admin User Manually

If you didn't create admin during migration:

```bash
cd backend
node scripts/create-admin.js
```

Make sure `ADMIN_EMAIL` and `ADMIN_PASSWORD` are set in `.env` before running.

#### Reset Database

**⚠️ WARNING: This will delete all data!**

```sql
-- Connect to MySQL
mysql -u root -p

-- Drop and recreate database
DROP DATABASE IF EXISTS hr_management;
CREATE DATABASE hr_management CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Exit
EXIT;
```

Then run migrations again:
```bash
cd backend
npm run migrate
```

---

## 🏃 Running the Project

### Development Mode

#### Backend
```bash
cd backend
npm run dev
```
- Runs on http://localhost:3001
- Auto-reloads on file changes (using nodemon)

#### Frontend
```bash
cd frontend
npm run dev
```
- Runs on http://localhost:3000
- Hot module replacement (HMR) enabled

### Production Mode

#### Backend
```bash
cd backend
npm start
```

#### Frontend
```bash
cd frontend
npm run build
npm run preview
```

### Using Both Servers

You need **two terminal windows**:

**Terminal 1 (Backend):**
```bash
cd backend
npm run dev
```

**Terminal 2 (Frontend):**
```bash
cd frontend
npm run dev
```

---

## 📡 API Documentation

### Base URL
```
http://localhost:3001/api
```

### Authentication Endpoints

#### Login
```http
POST /api/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "token": "uuid-token-here",
  "user": {
    "id": 1,
    "email": "user@example.com",
    "role": "admin",
    "name": "Admin User"
  }
}
```

#### Logout
```http
POST /api/logout
Authorization: Bearer <token>
```

#### Get Current User
```http
GET /api/me
Authorization: Bearer <token>
```

### Admin Endpoints

All admin endpoints require `Authorization: Bearer <token>` header and admin role.

#### Create Employee
```http
POST /api/admin/employees
Authorization: Bearer <token>
Content-Type: application/json

{
  "email": "employee@example.com",
  "password": "password123",
  "name": "John Doe",
  "role": "employee",
  "employee_id": "EMP001",
  "department": "Engineering",
  "phone": "+1234567890",
  "joined_on": "2024-01-15",
  "address": "123 Main St",
  "contact_number": "+1234567890"
}
```

#### Update Employee
```http
PUT /api/admin/employees/:id
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "John Doe Updated",
  "role": "manager",
  "department": "Engineering",
  "phone": "+1234567890"
}
```

#### List All Users
```http
GET /api/admin/users
Authorization: Bearer <token>
```

#### Delete User
```http
DELETE /api/admin/users/:id
Authorization: Bearer <token>
```

#### Get Leave Requests
```http
GET /api/admin/leave-requests
Authorization: Bearer <token>
```

#### Approve Leave Request
```http
PUT /api/admin/leave-requests/:id/approve
Authorization: Bearer <token>
```

#### Reject Leave Request
```http
PUT /api/admin/leave-requests/:id/reject
Authorization: Bearer <token>
```

### Employee Endpoints

All employee endpoints require `Authorization: Bearer <token>` header.

#### Get Profile
```http
GET /api/employee/:id
Authorization: Bearer <token>
```

#### Update Profile
```http
PUT /api/employee/:id/profile
Authorization: Bearer <token>
Content-Type: application/json

{
  "display_name": "John Doe",
  "bio": "Software Engineer"
}
```

#### Mark Attendance
```http
POST /api/employee/:id/attendance/mark
Authorization: Bearer <token>
```

#### Get Attendance Records
```http
GET /api/employee/:id/attendance
Authorization: Bearer <token>
```

#### Get Leave Balance
```http
GET /api/employee/:id/leave-balance
Authorization: Bearer <token>
```

#### Apply for Leave
```http
POST /api/employee/:id/leaves
Authorization: Bearer <token>
Content-Type: application/json

{
  "type": "sick",
  "start_date": "2024-02-01",
  "end_date": "2024-02-03",
  "reason": "Feeling unwell"
}
```

#### Get Leave History
```http
GET /api/employee/:id/leaves
Authorization: Bearer <token>
```

#### Get Notifications
```http
GET /api/employee/:id/notifications
Authorization: Bearer <token>
```

---

## 📁 Project Structure

```
hr-management/
├── backend/
│   ├── src/
│   │   ├── controllers/          # Request handlers
│   │   │   ├── adminController.js
│   │   │   ├── authController.js
│   │   │   └── userController.js
│   │   ├── db/
│   │   │   └── db.js             # Database connection pool
│   │   ├── middlewares/          # Express middlewares
│   │   │   ├── authToken.js      # Token validation
│   │   │   ├── requireRole.js   # Role-based access control
│   │   │   └── rateLimiter.js   # Rate limiting
│   │   ├── migrations/
│   │   │   └── migrate.js        # Database migration script
│   │   ├── routes/               # API routes
│   │   │   ├── admin.js
│   │   │   ├── auth.js
│   │   │   └── users.js
│   │   ├── utils/                # Utility functions
│   │   │   ├── hash.js           # Password hashing
│   │   │   └── token.js          # Token generation
│   │   └── server.js             # Express app entry point
│   ├── scripts/
│   │   ├── create-admin.js       # CLI script to create admin
│   │   └── setup-database.js     # Database setup helper
│   ├── .env                       # Environment variables (create this)
│   ├── .env.example               # Environment variables template
│   ├── package.json
│   └── package-lock.json
├── frontend/
│   ├── src/
│   │   ├── components/           # React components
│   │   │   └── PrivateRoute.jsx # Protected route component
│   │   ├── contexts/             # React contexts
│   │   │   └── AuthContext.jsx   # Authentication context
│   │   ├── pages/                # Page components
│   │   │   ├── AdminDashboard.jsx
│   │   │   ├── AdminDashboard.css
│   │   │   ├── EmployeeDashboard.jsx
│   │   │   ├── EmployeeDashboard.css
│   │   │   ├── Login.jsx
│   │   │   └── Login.css
│   │   ├── App.jsx               # Main app component
│   │   ├── index.css             # Global styles
│   │   └── main.jsx              # React entry point
│   ├── .env                       # Frontend env vars (optional)
│   ├── index.html
│   ├── package.json
│   ├── package-lock.json
│   ├── tailwind.config.js        # Tailwind configuration
│   ├── postcss.config.js         # PostCSS configuration
│   └── vite.config.js            # Vite configuration
├── README.md                      # Main readme
├── COMPLETE_SETUP_GUIDE.md       # This file
└── [other documentation files]
```

---

## 👥 User Roles & Workflows

### Admin Role

**Login:** Use admin credentials set in `ADMIN_EMAIL` and `ADMIN_PASSWORD`

**Capabilities:**
- View dashboard with statistics
- Add, edit, and delete employees
- Approve/reject leave requests
- View all employee data
- Access reports and analytics
- Manage system settings

**Workflow:**
1. Login at `/login`
2. Redirected to `/admin/dashboard`
3. Navigate using sidebar:
   - **Dashboard**: Overview statistics
   - **Employee List**: Manage employees
   - **Leave Applications**: Review leave requests
   - **Reports**: View analytics
   - **Settings**: System configuration

### Employee Role

**Login:** Use credentials provided by admin

**Capabilities:**
- View personal dashboard
- Mark attendance
- Apply for leave
- View leave balance and history
- Update profile
- View notifications

**Workflow:**
1. Login at `/login`
2. Redirected to `/employee/:id`
3. Navigate using sidebar:
   - **Dashboard**: Personal statistics
   - **Attendance**: Mark and view attendance
   - **Leaves**: Apply and view leave history
   - **Settings**: Update profile

### Manager Role

**Login:** Use credentials provided by admin

**Capabilities:**
- Same as Employee, plus:
- View team member data (if implemented)
- Approve team leave requests (if implemented)

**Workflow:**
1. Login at `/login`
2. Redirected to `/manager/:id`
3. Similar interface to Employee dashboard

### HR Role

**Login:** Use credentials provided by admin

**Capabilities:**
- Same as Employee, plus:
- Access HR-specific features (if implemented)

**Workflow:**
1. Login at `/login`
2. Redirected to `/hr/:id`
3. Similar interface to Employee dashboard

---

## 🔧 Troubleshooting

### Common Issues and Solutions

#### 1. Database Connection Error

**Error:**
```
Error: connect ECONNREFUSED 127.0.0.1:3306
```

**Solutions:**
- Verify MySQL is running:
  ```bash
  # Windows
  net start mysql
  
  # macOS/Linux
  sudo systemctl start mysql
  # OR
  brew services start mysql
  ```
- Check database credentials in `.env`
- Verify database exists: `SHOW DATABASES;`
- Check MySQL port (default: 3306)

#### 2. Migration Errors

**Error:**
```
Error: Table 'employees' already exists
```

**Solutions:**
- Drop and recreate database (see Database Setup section)
- Or manually drop tables:
  ```sql
  DROP TABLE IF EXISTS notifications;
  DROP TABLE IF EXISTS failed_logins;
  DROP TABLE IF EXISTS audit_logs;
  -- ... (drop all tables in reverse order)
  ```

#### 3. Admin User Not Created

**Issue:** No admin user after migration

**Solutions:**
- Check `ADMIN_EMAIL` and `ADMIN_PASSWORD` in `.env`
- Run admin creation script:
  ```bash
  cd backend
  node scripts/create-admin.js
  ```
- Or create manually via SQL (see Database Setup)

#### 4. Frontend Can't Connect to Backend

**Error:**
```
Network Error
Failed to fetch
```

**Solutions:**
- Verify backend is running on port 3001
- Check `VITE_API_BASE_URL` in frontend `.env`
- Verify CORS is enabled in backend
- Check browser console for detailed errors
- Try accessing backend directly: http://localhost:3001/health

#### 5. Port Already in Use

**Error:**
```
Error: listen EADDRINUSE: address already in use :::3001
```

**Solutions:**
- Find and kill process using port:
  ```bash
  # Windows
  netstat -ano | findstr :3001
  taskkill /PID <PID> /F
  
  # macOS/Linux
  lsof -ti:3001 | xargs kill -9
  ```
- Or change port in `.env`: `PORT=3002`

#### 6. npm Install Errors

**Error:**
```
npm ERR! code ERESOLVE
```

**Solutions:**
- Clear npm cache: `npm cache clean --force`
- Delete `node_modules` and `package-lock.json`
- Reinstall: `npm install`
- Try with `--legacy-peer-deps`: `npm install --legacy-peer-deps`

#### 7. Token Expired

**Error:**
```
401 Unauthorized
Token expired
```

**Solutions:**
- Login again to get new token
- Increase `TOKEN_EXPIRY_HOURS` in `.env`
- Tokens are stored in `api_tokens` table with expiry

#### 8. Module Not Found

**Error:**
```
Error: Cannot find module 'xxx'
```

**Solutions:**
- Run `npm install` in the respective directory (backend/frontend)
- Check `package.json` for correct dependencies
- Delete `node_modules` and reinstall

### Getting Help

1. Check error messages in terminal/console
2. Verify all prerequisites are installed
3. Check environment variables are set correctly
4. Review database connection and credentials
5. Check if ports are available
6. Review this guide's troubleshooting section

---

## 🔒 Security Best Practices

### Development

1. **Never commit `.env` files**
   - Add `.env` to `.gitignore`
   - Use `.env.example` as template

2. **Use Strong Passwords**
   - Admin password should be strong
   - Use password manager

3. **Keep Dependencies Updated**
   ```bash
   npm audit
   npm audit fix
   ```

### Production

1. **Use HTTPS**
   - Never use HTTP in production
   - Configure SSL/TLS certificates

2. **Environment Variables**
   - Use secure secret management
   - Never expose credentials

3. **Database Security**
   - Use strong database passwords
   - Limit database user permissions
   - Enable MySQL SSL if possible

4. **Token Storage**
   - Consider HttpOnly cookies instead of localStorage
   - Implement token refresh mechanism
   - Set appropriate token expiry

5. **Rate Limiting**
   - Already implemented on login endpoints
   - Consider adding to other endpoints

6. **CORS Configuration**
   - Restrict CORS to specific origins in production
   - Don't use `*` for allowed origins

7. **Input Validation**
   - Validate all user inputs
   - Use parameterized queries (already implemented)

8. **Error Handling**
   - Don't expose sensitive error details in production
   - Log errors securely

---

## 🚀 Production Deployment

### Backend Deployment

1. **Set Production Environment**
   ```env
   NODE_ENV=production
   PORT=3001
   ```

2. **Build and Start**
   ```bash
   npm start
   ```

3. **Use Process Manager** (PM2 recommended)
   ```bash
   npm install -g pm2
   pm2 start src/server.js --name hr-backend
   pm2 save
   pm2 startup
   ```

### Frontend Deployment

1. **Build for Production**
   ```bash
   npm run build
   ```

2. **Serve Static Files**
   - Use Nginx, Apache, or CDN
   - Point to `dist/` folder

3. **Configure API URL**
   ```env
   VITE_API_BASE_URL=https://api.yourdomain.com/api
   ```

### Database

1. **Backup Regularly**
   ```bash
   mysqldump -u root -p hr_management > backup.sql
   ```

2. **Use Connection Pooling** (already implemented)

3. **Monitor Performance**
   - Use MySQL slow query log
   - Monitor connection pool usage

### Reverse Proxy (Nginx Example)

```nginx
server {
    listen 80;
    server_name yourdomain.com;

    # Frontend
    location / {
        root /path/to/frontend/dist;
        try_files $uri $uri/ /index.html;
    }

    # Backend API
    location /api {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

---

## 📝 Additional Notes

### Creating Additional Admin Users

After initial setup, you can create more admin users:

1. **Via Admin Dashboard:**
   - Login as admin
   - Go to Employee List
   - Add new employee with role "admin"

2. **Via SQL:**
   ```sql
   INSERT INTO employees (email, password_hash, role, name)
   VALUES ('newadmin@example.com', '<bcrypt_hash>', 'admin', 'New Admin');
   ```

### Updating Dependencies

```bash
# Backend
cd backend
npm update

# Frontend
cd frontend
npm update
```

### Database Backup

```bash
# Create backup
mysqldump -u root -p hr_management > backup_$(date +%Y%m%d).sql

# Restore backup
mysql -u root -p hr_management < backup_20240101.sql
```

---

## ✅ Verification Checklist

After installation, verify everything works:

- [ ] MySQL is running and accessible
- [ ] Database `hr_management` exists
- [ ] Backend `.env` file is configured
- [ ] Backend migrations completed successfully
- [ ] Backend server starts without errors
- [ ] Backend health check returns OK: http://localhost:3001/health
- [ ] Frontend `.env` file is configured (optional)
- [ ] Frontend dependencies installed
- [ ] Frontend dev server starts without errors
- [ ] Can access login page: http://localhost:3000
- [ ] Can login with admin credentials
- [ ] Admin dashboard loads correctly
- [ ] Can create new employee
- [ ] New employee can login

---

## 🎉 Success!

If you've completed all steps and verified the checklist, congratulations! Your HR Management System is now running.

**Next Steps:**
1. Create additional employees via Admin Dashboard
2. Test all features
3. Customize as needed
4. Deploy to production when ready

**Support:**
- Review this guide for common issues
- Check error logs in terminal/console
- Verify all environment variables
- Ensure database is properly configured

---

**Last Updated:** 2024
**Version:** 1.0.0

