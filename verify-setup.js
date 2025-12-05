#!/usr/bin/env node

/**
 * Complete Project Verification Script
 * Run this to verify all parts of the HR Management System are set up correctly
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import http from 'http';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function checkFile(path, name) {
  try {
    readFileSync(path);
    log(`✓ ${name} exists`, 'green');
    return true;
  } catch (error) {
    log(`✗ ${name} missing: ${path}`, 'red');
    return false;
  }
}

function checkBackendHealth() {
  return new Promise((resolve) => {
    const req = http.get('http://localhost:3001/health', (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.status === 'ok') {
            log('✓ Backend server is running', 'green');
            resolve(true);
          } else {
            log('✗ Backend health check failed', 'red');
            resolve(false);
          }
        } catch (error) {
          log('✗ Backend response invalid', 'red');
          resolve(false);
        }
      });
    });

    req.on('error', () => {
      log('✗ Backend server not running on port 3001', 'yellow');
      log('  Start it with: cd backend && npm run dev', 'yellow');
      resolve(false);
    });

    req.setTimeout(2000, () => {
      req.destroy();
      log('✗ Backend server timeout', 'red');
      resolve(false);
    });
  });
}

async function main() {
  log('\n=== HR Management System - Setup Verification ===\n', 'blue');

  let allGood = true;

  // Check backend files
  log('Checking Backend Files...', 'blue');
  const backendFiles = [
    ['backend/package.json', 'Backend package.json'],
    ['backend/src/server.js', 'Backend server.js'],
    ['backend/src/db/db.js', 'Database connection'],
    ['backend/src/controllers/authController.js', 'Auth controller'],
    ['backend/src/controllers/adminController.js', 'Admin controller'],
    ['backend/src/controllers/userController.js', 'User controller'],
    ['backend/src/middlewares/authToken.js', 'Auth middleware'],
    ['backend/src/routes/auth.js', 'Auth routes'],
    ['backend/src/routes/admin.js', 'Admin routes'],
    ['backend/src/routes/users.js', 'User routes'],
    ['backend/src/migrations/migrate.js', 'Migration script'],
    ['backend/.env.example', 'Backend .env.example'],
  ];

  for (const [path, name] of backendFiles) {
    if (!checkFile(join(__dirname, path), name)) {
      allGood = false;
    }
  }

  // Check frontend files
  log('\nChecking Frontend Files...', 'blue');
  const frontendFiles = [
    ['frontend/package.json', 'Frontend package.json'],
    ['frontend/src/App.jsx', 'Frontend App.jsx'],
    ['frontend/src/main.jsx', 'Frontend main.jsx'],
    ['frontend/src/contexts/AuthContext.jsx', 'Auth context'],
    ['frontend/src/pages/Login.jsx', 'Login page'],
    ['frontend/src/pages/AdminLogin.jsx', 'Admin login page'],
    ['frontend/src/pages/AdminDashboard.jsx', 'Admin dashboard'],
    ['frontend/src/pages/EmployeeDashboard.jsx', 'Employee dashboard'],
    ['frontend/vite.config.js', 'Vite config'],
  ];

  for (const [path, name] of frontendFiles) {
    if (!checkFile(join(__dirname, path), name)) {
      allGood = false;
    }
  }

  // Check documentation
  log('\nChecking Documentation...', 'blue');
  const docs = [
    ['README.md', 'README'],
    ['INSTALLATION.md', 'Installation guide'],
    ['SETUP_COMPLETE.md', 'Setup guide'],
    ['TROUBLESHOOTING.md', 'Troubleshooting guide'],
  ];

  for (const [path, name] of docs) {
    checkFile(join(__dirname, path), name);
  }

  // Check backend server
  log('\nChecking Backend Server...', 'blue');
  const backendRunning = await checkBackendHealth();

  // Summary
  log('\n=== Summary ===', 'blue');
  if (allGood && backendRunning) {
    log('✓ All checks passed! Project is ready.', 'green');
    log('\nNext steps:', 'yellow');
    log('1. Make sure MySQL is running');
    log('2. Run: cd backend && npm run migrate');
    log('3. Start backend: cd backend && npm run dev');
    log('4. Start frontend: cd frontend && npm run dev');
    log('5. Open: http://localhost:3000/admin/login');
  } else {
    log('✗ Some checks failed. Please review above.', 'red');
    if (!backendRunning) {
      log('\nTo start backend:', 'yellow');
      log('  cd backend');
      log('  npm install  # if not done');
      log('  npm run dev');
    }
  }

  log('\n');
}

main().catch(console.error);

