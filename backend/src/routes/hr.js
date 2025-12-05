import express from 'express';
import {
  getUsers,
  deleteUser,
  getLeaveRequests,
  approveLeaveRequest,
  rejectLeaveRequest,
  getHrAnalytics
} from '../controllers/adminController.js';

import { authToken } from '../middlewares/authToken.js';
import { requireRole } from '../middlewares/requireRole.js';

const router = express.Router();

router.use(authToken);
router.use(requireRole('hr', 'admin')); // HR + admin can view analytics

router.get('/users', getUsers);
router.delete('/users/:id', deleteUser);
router.get('/leave-requests', getLeaveRequests);
router.put('/leave-requests/:id/approve', approveLeaveRequest);
router.put('/leave-requests/:id/reject', rejectLeaveRequest);
router.get('/analytics', getHrAnalytics);

export default router;
