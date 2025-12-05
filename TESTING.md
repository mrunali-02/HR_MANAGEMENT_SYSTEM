# Testing Guide

This document provides curl examples and a smoke test checklist for the HR Management System.

## Prerequisites

- Backend server running on `http://localhost:3001`
- Database migrated and admin user created (if using admin endpoints)

## Curl Examples

### 1. Admin Login

```bash
# Replace with your actual admin email and password
curl -X POST http://localhost:3001/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "your_admin_password"
  }'
```

**Expected Response:**
```json
{
  "token": "uuid-token-here",
  "user": {
    "id": 1,
    "email": "admin@example.com",
    "role": "admin",
    "name": "Administrator"
  }
}
```

**Save the token for subsequent requests:**
```bash
export ADMIN_TOKEN="your-token-here"
```

### 2. Create Employee (Admin Only)

```bash
curl -X POST http://localhost:3001/api/admin/employees \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{
    "email": "employee@example.com",
    "password": "employee_password",
    "name": "John Doe",
    "role": "employee"
  }'
```

**Expected Response:**
```json
{
  "id": 2,
  "email": "employee@example.com",
  "role": "employee",
  "name": "John Doe"
}
```

### 3. Create Manager (Admin Only)

```bash
curl -X POST http://localhost:3001/api/admin/employees \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{
    "email": "manager@example.com",
    "password": "manager_password",
    "name": "Jane Manager",
    "role": "manager"
  }'
```

### 4. Create HR (Admin Only)

```bash
curl -X POST http://localhost:3001/api/admin/employees \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{
    "email": "hr@example.com",
    "password": "hr_password",
    "name": "HR Person",
    "role": "hr"
  }'
```

### 5. Employee Login

```bash
curl -X POST http://localhost:3001/api/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "employee@example.com",
    "password": "employee_password"
  }'
```

**Expected Response:**
```json
{
  "token": "uuid-token-here",
  "user": {
    "id": 2,
    "email": "employee@example.com",
    "role": "employee",
    "name": "John Doe"
  }
}
```

**Save the token:**
```bash
export EMPLOYEE_TOKEN="employee-token-here"
```

### 6. Get Current User Info

```bash
curl -X GET http://localhost:3001/api/me \
  -H "Authorization: Bearer $EMPLOYEE_TOKEN"
```

**Expected Response:**
```json
{
  "user": {
    "id": 2,
    "email": "employee@example.com",
    "role": "employee",
    "name": "John Doe",
    "created_at": "2024-01-01T00:00:00.000Z"
  },
  "profile": {
    "display_name": "John Doe",
    "bio": null
  }
}
```

### 7. Get User Profile by Role and ID

```bash
curl -X GET http://localhost:3001/api/employee/2 \
  -H "Authorization: Bearer $EMPLOYEE_TOKEN"
```

### 8. List All Users (Admin Only)

```bash
curl -X GET http://localhost:3001/api/admin/users \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

**Expected Response:**
```json
{
  "users": [
    {
      "id": 1,
      "email": "admin@example.com",
      "name": "Administrator",
      "role": "admin",
      "created_at": "2024-01-01T00:00:00.000Z"
    },
    {
      "id": 2,
      "email": "employee@example.com",
      "name": "John Doe",
      "role": "employee",
      "created_at": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

### 9. Update Profile

```bash
curl -X PUT http://localhost:3001/api/profile \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $EMPLOYEE_TOKEN" \
  -d '{
    "display_name": "Johnny",
    "bio": "Software developer"
  }'
```

### 10. Logout

```bash
curl -X POST http://localhost:3001/api/logout \
  -H "Authorization: Bearer $EMPLOYEE_TOKEN"
```

**Expected Response:**
```json
{
  "message": "Logged out successfully"
}
```

### 11. Delete User (Admin Only)

```bash
curl -X DELETE http://localhost:3001/api/admin/users/2 \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

## Error Examples

### Invalid Credentials

```bash
curl -X POST http://localhost:3001/api/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "wrong@example.com",
    "password": "wrong_password"
  }'
```

**Expected Response (401):**
```json
{
  "error": "Invalid credentials"
}
```

### Missing Token

```bash
curl -X GET http://localhost:3001/api/me
```

**Expected Response (401):**
```json
{
  "error": "No token provided"
}
```

### Invalid Token

```bash
curl -X GET http://localhost:3001/api/me \
  -H "Authorization: Bearer invalid-token"
```

**Expected Response (401):**
```json
{
  "error": "Invalid token"
}
```

### Insufficient Permissions

```bash
# Employee trying to access admin endpoint
curl -X GET http://localhost:3001/api/admin/users \
  -H "Authorization: Bearer $EMPLOYEE_TOKEN"
```

**Expected Response (403):**
```json
{
  "error": "Insufficient permissions"
}
```

### Rate Limiting

Try logging in 6 times in quick succession:

```bash
for i in {1..6}; do
  curl -X POST http://localhost:3001/api/login \
    -H "Content-Type: application/json" \
    -d '{"email": "test@example.com", "password": "wrong"}'
  echo ""
done
```

**Expected Response (429) on 6th attempt:**
```json
{
  "error": "Too many login attempts, please try again later"
}
```

## Smoke Test Checklist

Follow these steps to verify the application works end-to-end:

### Backend Setup
- [ ] Database created and migrations run successfully
- [ ] Backend server starts without errors
- [ ] Health check endpoint returns 200: `curl http://localhost:3001/health`

### Admin Creation
- [ ] Admin user created (either via migration or CLI script)
- [ ] Admin can login via `/api/admin/login`
- [ ] Admin receives token in response

### Employee Management
- [ ] Admin can create employee via `/api/admin/employees`
- [ ] Employee password is hashed (check database)
- [ ] Profile is automatically created for new employee
- [ ] Admin can list all users via `/api/admin/users`

### Authentication
- [ ] Employee can login via `/api/login`
- [ ] Employee receives token and user info
- [ ] Employee can access `/api/me` with token
- [ ] Employee can access their profile via `/api/employee/:id`
- [ ] Logout invalidates token (token deleted from database)

### Authorization
- [ ] Employee cannot access admin endpoints (403)
- [ ] Employee cannot access other users' profiles (403)
- [ ] Admin can access all endpoints
- [ ] Invalid/missing tokens return 401

### Frontend
- [ ] Frontend dev server starts without errors
- [ ] Admin can login at `/admin/login`
- [ ] Admin redirected to `/admin/dashboard` after login
- [ ] Admin can add employees via UI
- [ ] New employees appear in user list immediately
- [ ] Employee can login at `/login`
- [ ] Employee redirected to `/employee/:id` after login
- [ ] Manager redirected to `/manager/:id` after login
- [ ] HR redirected to `/hr/:id` after login
- [ ] Logout clears token and redirects to login

### Security
- [ ] Rate limiting works on login endpoints
- [ ] Passwords are hashed with bcrypt
- [ ] Tokens expire after configured time
- [ ] Expired tokens are rejected and deleted

### Database
- [ ] No dummy data in database after migration (unless admin created)
- [ ] All user data persists after server restart
- [ ] Foreign key constraints work (deleting user deletes profile and tokens)

## Manual Testing Script

Save this as `test-api.sh`:

```bash
#!/bin/bash

BASE_URL="http://localhost:3001/api"

echo "1. Admin Login"
ADMIN_RESPONSE=$(curl -s -X POST $BASE_URL/admin/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@example.com", "password": "admin_password"}')
echo $ADMIN_RESPONSE | jq .

ADMIN_TOKEN=$(echo $ADMIN_RESPONSE | jq -r '.token')
export ADMIN_TOKEN

echo -e "\n2. Create Employee"
curl -s -X POST $BASE_URL/admin/employees \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"email": "test@example.com", "password": "test123", "name": "Test User", "role": "employee"}' | jq .

echo -e "\n3. Employee Login"
EMP_RESPONSE=$(curl -s -X POST $BASE_URL/login \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "test123"}')
echo $EMP_RESPONSE | jq .

EMP_TOKEN=$(echo $EMP_RESPONSE | jq -r '.token')

echo -e "\n4. Get Employee Profile"
curl -s -X GET $BASE_URL/me \
  -H "Authorization: Bearer $EMP_TOKEN" | jq .

echo -e "\n5. Logout"
curl -s -X POST $BASE_URL/logout \
  -H "Authorization: Bearer $EMP_TOKEN" | jq .

echo -e "\nTest completed!"
```

Make it executable and run:
```bash
chmod +x test-api.sh
./test-api.sh
```

**Note**: Requires `jq` for JSON formatting. Install with `brew install jq` (Mac) or `apt-get install jq` (Linux).

