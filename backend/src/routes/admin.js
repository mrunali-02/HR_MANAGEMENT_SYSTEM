import express from 'express';
import { authToken } from '../middlewares/authToken.js';
import { requireRole } from '../middlewares/requireRole.js';
import { loginRateLimiter } from '../middlewares/rateLimiter.js';
import {
    adminLogin,
    addEmployee,
    getUsers,
    updateEmployee,
    deleteUser,
    getLeaveRequests,
    approveLeaveRequest,
    rejectLeaveRequest,
    getHrAnalytics,      // if you have this
    updateAdminProfile,  // 👈 add this
    changeAdminPassword, // 👈 and this
  } from '../controllers/adminController.js';
  


const router = express.Router();

router.post('/login', loginRateLimiter, adminLogin);
router.post('/employees', authToken, requireRole('admin'), addEmployee);
router.put('/employees/:id', authToken, requireRole('admin'), updateEmployee);
router.get('/users', authToken, requireRole('admin'), getUsers);
router.delete('/users/:id', authToken, requireRole('admin'), deleteUser);
router.get('/leave-requests', authToken, requireRole('admin'), getLeaveRequests);
router.put('/leave-requests/:id/approve', authToken, requireRole('admin'), approveLeaveRequest);
router.put('/leave-requests/:id/reject', authToken, requireRole('admin'), rejectLeaveRequest);
router.put('/profile/update', authToken, updateAdminProfile);
router.put('/profile/change-password', authToken, changeAdminPassword);

export default router;

