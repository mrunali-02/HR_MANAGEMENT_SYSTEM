# Quick Start - Get Running in 5 Minutes

## Prerequisites Check
```bash
node --version  # Should be >= 18
mysql --version  # MySQL should be installed
```

## 1. Create Database (30 seconds)
```bash
mysql -u root -p
```
Then run:
```sql
CREATE DATABASE hr_management;
exit;
```

## 2. Backend Setup (2 minutes)
```bash
cd backend
npm install

# Create .env file
Copy-Item .env.example .env  # Windows
# OR: cp .env.example .env    # Linux/Mac

# Edit .env - Set these values:
# DB_PASS=your_mysql_password
# ADMIN_EMAIL=admin@test.com
# ADMIN_PASSWORD=admin123

npm run migrate
npm run dev
```

## 3. Frontend Setup (1 minute)
```bash
# New terminal
cd frontend
npm install
npm run dev
```

## 4. Login (30 seconds)
1. Open: `http://localhost:3000/login`
2. Email: `admin@test.com` (or what you set)
3. Password: `admin123` (or what you set)
4. Click "Sign in"

## Done! ✅

If login fails:
```bash
cd backend
node scripts/setup-database.js  # Check database state
```

For detailed setup, see `SETUP_COMPLETE.md`

