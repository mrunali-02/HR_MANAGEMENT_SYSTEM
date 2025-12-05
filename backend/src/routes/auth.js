import express from 'express';
import { login, logout, getMe } from '../controllers/authController.js';
import { authToken } from '../middlewares/authToken.js';
import { loginRateLimiter } from '../middlewares/rateLimiter.js';

const router = express.Router();

router.post('/login', loginRateLimiter, login);
router.post('/logout', authToken, logout);
router.get('/me', authToken, getMe);

export default router;

