import express from 'express';
import { authToken } from '../middlewares/authToken.js';
import { requireRole } from '../middlewares/requireRole.js';
import { loginRateLimiter } from '../middlewares/rateLimiter.js';
import {
  adminLogin,
  getDashboardSummary,
  addEmployee,
  getUsers,
  updateEmployee,
  deleteUser,
  getLeaveRequests,
  getLeaveStatistics,
  approveLeaveRequest,
  rejectLeaveRequest,
  getAllAttendanceRecords,
  getHrAnalytics,
  updateAdminProfile,
  changeAdminPassword,
  // Departments
  getDepartments,
  createDepartment,
  updateDepartment,
  deleteDepartment,
  // Holidays
  getHolidays,
  createHoliday,
  updateHoliday,
  deleteHoliday,
  // Leave Policies
  getLeavePolicies,
  createLeavePolicy,
  updateLeavePolicy,
  updateLeavePolicyByType,
  deleteLeavePolicy,
  // Attendance Corrections
  getAttendanceCorrections,
  approveAttendanceCorrection,
  rejectAttendanceCorrection,

  // Audit Logs
  getAuditLogs,
  // Notes
  getAdminNotes,
  createAdminNote,
  deleteAdminNote,
  // Reports
  getAttendanceReport,
  getLeaveReport,
  getEmployeeRoleStats,
  exportAttendance,
  exportLeaves,
  exportWorkHoursExcel,
  createAdminLeave,
} from '../controllers/adminController.js';

// Carry Forward imports
import {
  previewCarryForward,
  confirmCarryForward,
  getCarryForwardStatus,
  updateEmployeeCarryForward
} from '../controllers/carryForwardController.js';

const router = express.Router();

// -- Public / Auth --
router.post('/login', loginRateLimiter, adminLogin);

// -- Protected Routes (requireRole 'admin') --
router.use(authToken, requireRole('admin'));

// Dashboard summary
router.get('/dashboard/summary', getDashboardSummary);

// Admin Leave Broadcast
router.post('/leaves/create-broadcast', createAdminLeave);

// Employee Management
router.post('/employees', addEmployee);
router.put('/employees/:id', updateEmployee);
router.get('/users', getUsers);
router.delete('/users/:id', deleteUser);

// Leave Management
router.get('/leave-requests', authToken, requireRole('admin'), getLeaveRequests);
router.get('/leave-statistics', authToken, requireRole('admin'), getLeaveStatistics);
router.put('/leave-requests/:id/approve', authToken, requireRole('admin'), approveLeaveRequest);
router.put('/leave-requests/:id/reject', authToken, requireRole('admin'), rejectLeaveRequest);

// Leave Carry Forward
router.get('/leave-carry-forward/preview', authToken, requireRole('admin'), previewCarryForward);
router.post('/leave-carry-forward/confirm', authToken, requireRole('admin'), confirmCarryForward);
router.get('/leave-carry-forward/status', authToken, requireRole('admin'), getCarryForwardStatus);
router.put('/leave-carry-forward/employee/:id', authToken, requireRole('admin'), updateEmployeeCarryForward);

// Attendance Records (Work Hours)
router.get('/attendance-records', authToken, requireRole('admin'), getAllAttendanceRecords);

// Departments
router.get('/departments', authToken, requireRole('admin'), getDepartments);
router.post('/departments', authToken, requireRole('admin'), createDepartment);
router.put('/departments/:id', authToken, requireRole('admin'), updateDepartment);
router.delete('/departments/:id', authToken, requireRole('admin'), deleteDepartment);

// Holidays
router.get('/holidays', authToken, requireRole('admin'), getHolidays);
router.post('/holidays', authToken, requireRole('admin'), createHoliday);
router.put('/holidays/:id', authToken, requireRole('admin'), updateHoliday);
router.delete('/holidays/:id', authToken, requireRole('admin'), deleteHoliday);

// Leave Policies
router.get('/leave-policies', authToken, requireRole('admin'), getLeavePolicies);
router.post('/leave-policies', authToken, requireRole('admin'), createLeavePolicy);
router.put('/leave-policies/:id', authToken, requireRole('admin'), updateLeavePolicy);
router.put('/leave-policies/type/:type', authToken, requireRole('admin'), updateLeavePolicyByType);
router.delete('/leave-policies/:id', authToken, requireRole('admin'), deleteLeavePolicy);

// Attendance Corrections
router.get('/attendance-corrections', authToken, requireRole('admin'), getAttendanceCorrections);
router.put('/attendance-corrections/:id/approve', authToken, requireRole('admin'), approveAttendanceCorrection);
router.put('/attendance-corrections/:id/reject', authToken, requireRole('admin'), rejectAttendanceCorrection);



// Reports & Export
router.get('/reports/attendance', authToken, requireRole('admin'), getAttendanceReport);
router.get('/reports/leaves', authToken, requireRole('admin'), getLeaveReport);
router.get('/export/attendance', authToken, requireRole('admin'), exportAttendance);
router.get('/export/leaves', authToken, requireRole('admin'), exportLeaves);
router.get('/export/work-hours-excel', authToken, requireRole('admin'), exportWorkHoursExcel);

// Analytics & Audit
router.get('/analytics', authToken, requireRole('admin'), getHrAnalytics);
router.get('/audit-logs', authToken, requireRole('admin'), getAuditLogs);
router.get('/reports/attendance', authToken, requireRole('admin'), getAttendanceReport);
router.get('/reports/leaves', authToken, requireRole('admin'), getLeaveReport);
router.get('/reports/employee-roles', authToken, requireRole('admin'), getEmployeeRoleStats);

// Admin notes
router.get('/notes', authToken, requireRole('admin'), getAdminNotes);
router.post('/notes', authToken, requireRole('admin'), createAdminNote);
router.delete('/notes/:id', authToken, requireRole('admin'), deleteAdminNote);

// Profile
router.put('/profile/update', authToken, updateAdminProfile);
router.put('/profile/change-password', authToken, changeAdminPassword);

export default router;

