import express from 'express';
import { adminLogin, addEmployee, getUsers, deleteUser, updateEmployee, getLeaveRequests, approveLeaveRequest, rejectLeaveRequest } from '../controllers/adminController.js';
import { authToken } from '../middlewares/authToken.js';
import { requireRole } from '../middlewares/requireRole.js';
import { loginRateLimiter } from '../middlewares/rateLimiter.js';

const router = express.Router();

router.post('/login', loginRateLimiter, adminLogin);
router.post('/employees', authToken, requireRole('admin'), addEmployee);
router.put('/employees/:id', authToken, requireRole('admin'), updateEmployee);
router.get('/users', authToken, requireRole('admin'), getUsers);
router.delete('/users/:id', authToken, requireRole('admin'), deleteUser);
router.get('/leave-requests', authToken, requireRole('admin'), getLeaveRequests);
router.put('/leave-requests/:id/approve', authToken, requireRole('admin'), approveLeaveRequest);
router.put('/leave-requests/:id/reject', authToken, requireRole('admin'), rejectLeaveRequest);

export default router;

