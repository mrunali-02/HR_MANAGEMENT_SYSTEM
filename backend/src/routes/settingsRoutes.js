import express from 'express';
import { authToken as authenticateToken } from '../middlewares/authToken.js';
import { getSettings, updateSettings } from '../controllers/settingsController.js';

const router = express.Router();

// Get all settings
router.get('/', authenticateToken, getSettings);

// Update a specific setting category
router.put('/:category', authenticateToken, updateSettings);

export default router;
