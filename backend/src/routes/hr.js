import express from 'express';
import {
  getUsers,
  deleteUser,
  getLeaveRequests,
  approveLeaveRequest,
  rejectLeaveRequest,
  getHrAnalytics,
  getManagers,
  assignManager,
  getDashboardSummary,
  getAttendanceReport,
  getLeaveReport,
  exportAttendance,
  exportLeaves,
  exportEmployees,
  getWorkHoursStats,
  getAuditLogs,
  getAllAttendanceRecords,
  getCalendarSummary,
  createApprovedLeave,
  exportAuditLogs
} from '../controllers/adminController.js';

import { authToken } from '../middlewares/authToken.js';
import { requireRole } from '../middlewares/requireRole.js';

const router = express.Router();

router.use(authToken);
router.use(requireRole('hr', 'admin')); // HR + admin can view analytics

router.get('/users', getUsers);
router.get('/managers', getManagers);
router.put('/employees/:employeeId/assign-manager', assignManager);
router.delete('/users/:id', deleteUser);
router.post('/employees/:employeeId/leaves/create-approved', createApprovedLeave);
router.get('/leave-requests', getLeaveRequests);
router.put('/leave-requests/:id/approve', approveLeaveRequest);
router.put('/leave-requests/:id/reject', rejectLeaveRequest);
router.get('/analytics', getHrAnalytics);
router.get('/dashboard/summary', getDashboardSummary);
router.get('/analytics/work-hours', getWorkHoursStats);
router.get('/audit-logs', getAuditLogs);
router.get('/attendance-records', getAllAttendanceRecords);
router.get('/calendar-summary', getCalendarSummary);

// Reports & Exports
router.get('/reports/attendance', getAttendanceReport);
router.get('/reports/leaves', getLeaveReport);
router.get('/export/attendance', exportAttendance);
router.get('/export/leaves', exportLeaves);
router.get('/export/employees', exportEmployees);
router.get('/export/audit-logs', exportAuditLogs);

export default router;
