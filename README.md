# Vivekanand Technologies - HR Management System

A comprehensive, modern HR Management System (HRMS) designed for streamlined attendance tracking, leave management, and employee oversight.

## 🚀 Key Features

- **Attendance Management**: 
  - Real-time Check-in/Check-out with Geolocation validation.
  - Automated tracking of Late In and Left Early status.
- **Automated Workflows**: 
  - System-wide daily absenteeism checks.
  - Automatic force-checkout at end of business hours (7:00 PM).
  - WFH Attendance: Automatic remote attendance marking for approved Work From Home leaves.
- **Leave Management**: 
  - Structured Sick, Casual, and Planned leave policies.
  - Dynamic **Leave Carry Forward** system for year-end rollovers.
  - Multi-level approval workflow (Manager/HR/Admin).
- **Audit Logs**: 
  - Transparent tracking of all manual and automated system actions.
- **Advanced Dashboards**: 
  - Role-based views for Employees, Managers, HR, and Admins.
  - Real-time analytics and reporting.

---

## 🛠️ Technology Stack

- **Frontend**: React, Vite, Axios, Lucide Icons, Recharts (Analytics).
- **Backend**: Node.js, Express, MySQL.
- **Automation**: Node-cron (Scheduled tasks).
- **Security**: JWT-based Authentication, Bcrypt password hashing.

---

## ⚙️ Initial Setup

### 1. Prerequisites
- **Node.js**: v16.0.0 or higher.
- **MySQL**: v8.0 or higher.

### 2. Backend Installation
Navigate to the backend directory:
```bash
cd backend
npm install
```

Create a `.env` file in the `backend` folder:
```env
PORT=5000
DB_HOST=localhost
DB_USER=your_mysql_user
DB_PASS=your_mysql_password
DB_NAME=hr_management
JWT_SECRET=your_secret_key
OFFICE_LAT=your_office_latitude
OFFICE_LNG=your_office_longitude
MAX_DISTANCE=100
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=admin123
```

Run database migrations:
```bash
npm run migrate
```
*This will create all tables, seed default policies, and create the initial Admin user.*

Start the backend server:
```bash
npm run dev
```

### 3. Frontend Installation
Navigate to the frontend directory:
```bash
cd frontend
npm install
```

Configure the API base URL in `frontend/src/pages/EmployeeDashboard.jsx`, `HrDashboard.jsx`, etc., or via environment variables:
```env
VITE_API_BASE_URL=http://localhost:5000/api
```

Start the frontend development server:
```bash
npm run dev
```

---

## 📊 Roles & Permissions

- **Admin**: Full system access, audit log visibility, configuration management.
- **HR**: Recruitment, global attendance review, leave approval, analytics.
- **Manager**: Team oversight, direct report attendance, and leave approvals.
- **Employee**: Daily attendance marking, leave applications, and personal dashboards.

## 📝 License
This project is licensed under Vivekanand Technologies.
