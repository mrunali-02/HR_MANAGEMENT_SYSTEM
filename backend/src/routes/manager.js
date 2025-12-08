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

const router = express.Router();

// Manager profile
router.get("/:id", authToken, getManagerProfile);

// Team data routes
router.get("/team/attendance", authToken, getTeamAttendance);
router.get("/team/leave-requests", authToken, getTeamLeaveRequests);
router.put("/team/leave-requests/:id/approve", authToken, approveTeamLeave);
router.put("/team/leave-requests/:id/reject", authToken, rejectTeamLeave);
router.get("/team/work-hours", authToken, getTeamWorkHours);
router.get("/team/stats", authToken, getTeamStats);

export default router;
