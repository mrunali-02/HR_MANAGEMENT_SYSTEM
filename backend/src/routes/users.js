import express from 'express';
import {
  getUserProfile,
  updateProfile,
  getAttendance,
  markAttendance,
  markCheckout,
  getLeaveBalance,
  getLeaveHistory,
  createLeaveRequest,
  cancelLeave,
  getNotifications,
  updateEmployeeProfile,
  getOvertimes,
  createOvertime,
  getAttendanceCorrections,
  createAttendanceCorrection,
  changePassword
} from '../controllers/userController.js';
import { authToken } from '../middlewares/authToken.js';
import { uploadLeaveDoc } from '../middlewares/upload.js';

const router = express.Router();

// Attendance
router.get('/employee/:id/attendance', authToken, getAttendance);
router.post('/employee/:id/attendance/mark', authToken, markAttendance);
router.post('/employee/:id/attendance/checkout', authToken, markCheckout);

// Leaves
router.get('/employee/:id/leave-balance', authToken, getLeaveBalance);
router.get('/employee/:id/leaves', authToken, getLeaveHistory);
router.post('/employee/:id/leaves', authToken, uploadLeaveDoc.single('document'), createLeaveRequest);
router.put('/employee/:id/leaves/:leaveId/cancel', authToken, cancelLeave);

// Overtimes
router.get('/employee/:id/overtimes', authToken, getOvertimes);
router.post('/employee/:id/overtimes', authToken, createOvertime);

// Attendance Corrections
router.get('/employee/:id/attendance-corrections', authToken, getAttendanceCorrections);
router.post('/employee/:id/attendance-corrections', authToken, createAttendanceCorrection);

// Notifications & Profile
router.get('/employee/:id/notifications', authToken, getNotifications);
router.put('/employee/:id/profile', authToken, updateEmployeeProfile);
router.put('/employee/:id/change-password', authToken, changePassword);
router.get('/:role/:id', authToken, getUserProfile);
router.put('/profile', authToken, updateProfile);

export default router;
