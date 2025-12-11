import express from 'express';
import { authToken } from '../middlewares/authToken.js';
import { requireRole } from '../middlewares/requireRole.js';
import { getHolidays, addHoliday, deleteHoliday } from '../controllers/holidayController.js';

const router = express.Router();

// Public read (authenticated)
router.get('/', authToken, getHolidays);

// Admin/HR only write
router.post('/', authToken, requireRole('admin', 'hr'), addHoliday);
router.delete('/:id', authToken, requireRole('admin', 'hr'), deleteHoliday);

export default router;
