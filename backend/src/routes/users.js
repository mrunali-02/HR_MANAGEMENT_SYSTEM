import express from 'express';
import {
  getUserProfile,
  updateProfile,
  getAttendance,
  markAttendance,
  getLeaveBalance,
  getLeaveHistory,
  createLeaveRequest,
  getNotifications,
  updateEmployeeProfile
} from '../controllers/userController.js';
import { authToken } from '../middlewares/authToken.js';

const router = express.Router();

router.get('/employee/:id/attendance', authToken, getAttendance);
router.post('/employee/:id/attendance/mark', authToken, markAttendance);
router.get('/employee/:id/leave-balance', authToken, getLeaveBalance);
router.get('/employee/:id/leaves', authToken, getLeaveHistory);
router.post('/employee/:id/leaves', authToken, createLeaveRequest);
router.get('/employee/:id/notifications', authToken, getNotifications);
router.put('/employee/:id/profile', authToken, updateEmployeeProfile);
router.get('/:role/:id', authToken, getUserProfile);
router.put('/profile', authToken, updateProfile);

export default router;
