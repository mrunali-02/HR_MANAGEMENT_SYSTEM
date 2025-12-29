import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.js';
import adminRoutes from './routes/admin.js';
import hrRoutes from './routes/hr.js';
import managerRoutes from './routes/manager.js';
import userRoutes from './routes/users.js';
import settingsRoutes from './routes/settingsRoutes.js';
import path from 'path';
import holidayRoutes from './routes/holidays.js';
import { initAttendanceCron } from './cron/attendanceJobs.js';

dotenv.config();

const app = express();

// Ensure this matches the port in your Airtel Router Rule #2
const PORT = process.env.PORT || 5000; 

// Middleware - Updated CORS to allow your Static IP
app.use(cors({
  origin: [
    'http://122.179.153.216:8080', // Your public frontend address
    'http://localhost:8080',       // Local development
    'http://192.168.1.12:8080'     // Local network address
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static('uploads'));

// Routes
app.use('/api', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/admin/settings', settingsRoutes);
app.use('/api/hr', hrRoutes);
app.use('/api/manager', managerRoutes);
app.use('/api/holidays', holidayRoutes);
app.use('/api', userRoutes);

// Health check - Use this to test if your Static IP is working
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'HR Management API is running' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Start Server listening on all network interfaces
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on all interfaces at port ${PORT}`);
  console.log(`External Health check: http://122.179.153.216:${PORT}/health`);
  
  // Initialize Cron Jobs
  initAttendanceCron();
});