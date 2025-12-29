import express from "express";
import { authToken } from "../middlewares/authToken.js";
import {
  getManagerProfile,
  getTeamAttendance,
  getTeamLeaveRequests,
  approveTeamLeave,
  rejectTeamLeave,
  getTeamWorkHours,
  getTeamStats
} from "../controllers/managerController.js";
import { getUserProfile } from '../controllers/userController.js';

const router = express.Router();

// Team data routes
router.get("/team/attendance", authToken, getTeamAttendance);
router.get("/team/leave-requests", authToken, getTeamLeaveRequests);
router.put("/team/leave-requests/:id/approve", authToken, approveTeamLeave);
router.put("/team/leave-requests/:id/reject", authToken, rejectTeamLeave);
router.get("/team/work-hours", authToken, getTeamWorkHours);
router.get("/team/stats", authToken, getTeamStats);

// Parameterized routes last
router.get("/:id", authToken, getManagerProfile);
router.get("/profile/:id", authToken, getUserProfile);

export default router;
