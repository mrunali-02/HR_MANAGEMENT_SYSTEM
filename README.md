# HR Management System

A complete HR Management web application built with Node.js, Express, React, and MySQL. Features token-based authentication with no external dependencies like Firebase.

## Quick Start

**For detailed installation instructions, see [INSTALLATION.md](./INSTALLATION.md) or [SETUP_COMPLETE.md](./SETUP_COMPLETE.md)**

### Fast Setup (5 minutes)
See [QUICK_START.md](./QUICK_START.md) for the fastest way to get running.

### Standard Setup
```bash
# 1. Create MySQL database
mysql -u root -p
CREATE DATABASE hr_management;
exit;

# 2. Backend setup
cd backend
npm install
# Copy .env.example to .env and edit with your database credentials
# IMPORTANT: Set ADMIN_EMAIL and ADMIN_PASSWORD in .env
npm run migrate
npm run dev

# 3. Frontend setup (new terminal)
cd frontend
npm install
npm run dev

# 4. Open browser: http://localhost:3000/login
# Admins, managers, HR, and employees all sign in from the same page.
```

### Verify Setup
```bash
# Check if everything is configured correctly
node verify-setup.js

# Or check database state
cd backend
npm run setup-db
```

## Features

- **Token-based Authentication**: Simple DB-backed UUID token authentication
- **Role-based Access Control**: Admin, Employee, Manager, and HR roles
- **No Dummy Data**: Clean database - all users must be created manually by admin
- **Secure Password Hashing**: bcrypt with configurable salt rounds
- **Rate Limiting**: Protection against brute force attacks on login endpoints

## Tech Stack

### Backend
- Node.js (>=18)
- Express.js
- MySQL (mysql2/promise)
- bcrypt for password hashing
- UUID for token generation
- express-rate-limit for rate limiting

### Frontend
- React 18
- Vite
- React Router
- Axios
- Tailwind CSS

## Prerequisites

- Node.js >= 18
- MySQL >= 5.7 or MariaDB >= 10.2
- npm or yarn

## Installation

### 1. Clone the repository

```bash
git clone <repository-url>
cd hr-management
```

### 2. Backend Setup

```bash
cd backend
npm install
```

Create a `.env` file from `.env.example`:

```bash
cp .env.example .env
```

Edit `.env` with your database credentials:

```env
DB_HOST=localhost
DB_USER=root
DB_PASS=your_password
DB_NAME=hr_management
PORT=3001
TOKEN_EXPIRY_HOURS=24
BCRYPT_SALT_ROUNDS=10

# Optional: Set these to create admin during migration
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=your_secure_password
```

**Important**: If you don't set `ADMIN_EMAIL` and `ADMIN_PASSWORD` before running migrations, no admin user will be created. You can create one later using the CLI script (see below).

### 3. Run Database Migrations

```bash
npm run migrate
```

This will:
- Create all necessary tables (`employees`, `profiles`, `api_tokens`)
- Optionally create an admin user if `ADMIN_EMAIL` and `ADMIN_PASSWORD` are set in `.env`

### 4. Start Backend Server

```bash
npm run dev
```

The backend will run on `http://localhost:3001`

### 5. Frontend Setup

Open a new terminal:

```bash
cd frontend
npm install
```

Create a `.env` file (optional, defaults to `http://localhost:3001/api`):

```env
VITE_API_BASE_URL=http://localhost:3001/api
```

### 6. Start Frontend Development Server

```bash
npm run dev
```

The frontend will run on `http://localhost:3000`

## Creating Admin User

### Option 1: During Migration (Recommended)

Set `ADMIN_EMAIL` and `ADMIN_PASSWORD` in `backend/.env` before running `npm run migrate`.

### Option 2: Using CLI Script

If you didn't create admin during migration, you can create one later:

```bash
cd backend
# Make sure ADMIN_EMAIL and ADMIN_PASSWORD are set in .env
node scripts/create-admin.js
```

### Option 3: Manual SQL

```sql
INSERT INTO employees (email, password_hash, role, name)
VALUES ('admin@example.com', '<bcrypt_hash>', 'admin', 'Administrator');

-- Then create profile
INSERT INTO profiles (user_id, display_name)
VALUES (LAST_INSERT_ID(), 'Administrator');
```

**Note**: You'll need to generate the bcrypt hash yourself for manual SQL insertion.

## API Endpoints

### Authentication

- `POST /api/login` - Admin/Employee/Manager/HR login
- `POST /api/admin/login` - Admin login (legacy helper endpoint)
- `POST /api/logout` - Logout (requires token)
- `GET /api/me` - Get current user info (requires token)

### Admin Only

- `POST /api/admin/employees` - Create new employee (requires admin token)
- `PUT /api/admin/employees/:id` - Update employee metadata (requires admin token)
- `GET /api/admin/users` - List all users (requires admin token)
- `GET /api/admin/leave-requests` - List all submitted leave requests
- `PUT /api/admin/leave-requests/:id/approve` - Approve a leave request (requires admin token)
- `PUT /api/admin/leave-requests/:id/reject` - Reject a leave request (requires admin token)
- `DELETE /api/admin/users/:id` - Delete user (requires admin token)

### Employee Self-Service

- `GET /api/employee/:id/attendance` - Last 30 days of attendance + today
- `POST /api/employee/:id/attendance/mark` - Mark attendance for today
- `GET /api/employee/:id/leave-balance` - Leave balances (per policy)
- `GET /api/employee/:id/leaves` - Leave history
- `POST /api/employee/:id/leaves` - Submit leave request
- `GET /api/employee/:id/notifications` - Latest notifications
- `PUT /api/employee/:id/profile` - Update profile (name, display name, bio)
- `GET /api/:role/:id` - Read profile by role (admin override supported)
- `PUT /api/profile` - Update own profile (display name/bio) for current user

### Database Tables

`npm run migrate` creates all required tables automatically:

- Core: `employees`, `profiles`, `api_tokens`
- Org setup: `roles`, `departments`, `holidays`, `leave_policies`
- Operations: `attendance`, `attendance_corrections`, `leave_requests`, `overtimes`
- Auditing/Security: `audit_logs`, `failed_logins`, `notifications`

These tables power the admin console and the employee self-service dashboard.

## Usage

### Admin Workflow

1. Login at `/login` using the admin credentials
2. Navigate to Admin Dashboard
3. Click "Add Employee" to create new users
4. Select role (Employee, Manager, or HR) from dropdown
5. New employees can immediately login at `/login`

### Employee/Manager/HR Workflow

1. Login at `/login` using credentials provided by admin
2. Automatically redirected to role-specific dashboard:
   - Employees → `/employee/:id`
   - Managers → `/manager/:id`
   - HR → `/hr/:id`

## Security Notes

- **Token Storage**: Currently using `localStorage` for token storage. For production, consider:
  - HttpOnly cookies (more secure, prevents XSS)
  - Secure session storage
  - Token refresh mechanism
- **HTTPS**: Always use HTTPS in production
- **Environment Variables**: Never commit `.env` files
- **Password Policy**: Consider implementing password strength requirements
- **Token Expiry**: Tokens expire after 24 hours by default (configurable via `TOKEN_EXPIRY_HOURS`)

## Testing

See `TESTING.md` for curl examples and smoke test checklist.

## Project Structure

```
hr-management/
├── backend/
│   ├── src/
│   │   ├── controllers/     # Request handlers
│   │   ├── middlewares/      # Auth, rate limiting, etc.
│   │   ├── routes/           # API routes
│   │   ├── db/               # Database connection
│   │   ├── utils/            # Helpers (hash, token)
│   │   ├── migrations/       # Database migration script
│   │   └── server.js         # Express app entry point
│   ├── scripts/              # Utility scripts
│   ├── .env.example          # Environment variables template
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── pages/            # React pages
│   │   ├── components/       # Reusable components
│   │   ├── contexts/         # React contexts (Auth)
│   │   └── App.jsx           # Main app component
│   ├── .env.example          # Frontend env template
│   └── package.json
└── README.md
```

## Troubleshooting

### Database Connection Issues

- Verify MySQL is running
- Check `.env` credentials
- Ensure database exists: `CREATE DATABASE hr_management;`

### Migration Errors

- Ensure database exists before running migration
- Check that MySQL user has CREATE TABLE permissions
- If admin creation fails, check that `ADMIN_EMAIL` and `ADMIN_PASSWORD` are set

### Frontend Can't Connect to Backend

- Verify backend is running on port 3001
- Check CORS settings in `backend/src/server.js`
- Verify `VITE_API_BASE_URL` in frontend `.env`

## License

ISC

## Contributing

This is a complete, production-ready application. No dummy data is included - all users must be created through the admin interface.

