/**
 * Vajra Lock App — Backend Server
 * Node.js + Express + MongoDB (Mongoose)
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const connectDB = require('./config/db');

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Middleware ───
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// ─── Routes ───
app.use('/api/auth', require('./routes/auth'));
app.use('/api/shopkeepers', require('./routes/shopkeepers'));
app.use('/api/profile', require('./routes/profile'));
app.use('/api/devices', require('./routes/devices'));
app.use('/api/device', require('./routes/deviceCompat'));
app.use('/api/keys', require('./routes/keys'));
app.use('/api/commands', require('./routes/commands'));
app.use('/api/credits', require('./routes/credits'));
app.use('/api/tickets', require('./routes/tickets'));
app.use('/api/announcements', require('./routes/announcements'));
app.use('/api/config', require('./routes/config'));

// ─── Health Check ───
app.get('/api/health', (req, res) => {
  let fcmStatus = { initialized: false, error: 'FCM module not loaded' };
  try {
    const { getFcmStatus } = require('./services/fcm');
    fcmStatus = getFcmStatus();
  } catch (err) {
    fcmStatus.error = err.message;
  }

  res.json({
    success: true,
    message: 'Vajra Lock App Server is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    fcm: fcmStatus,
  });
});

// ─── 404 Handler ───
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.originalUrl} not found`,
  });
});

// ─── Global Error Handler ───
app.use((err, req, res, next) => {
  console.error('❌ Unhandled Error:', err.stack);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

let serverInstance;

// ─── Start Server ───
const startServer = async () => {
  try {
    await connectDB();
    serverInstance = app.listen(PORT, () => {
      console.log(`\n🚀 Vajra Server running on http://localhost:${PORT}`);
      console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`   Health check: http://localhost:${PORT}/api/health\n`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error.message);
    process.exit(1);
  }
};

// ─── Graceful Shutdown ───
const gracefulShutdown = async (signal) => {
  console.log(`\n👋 Received ${signal}. Starting graceful shutdown...`);
  
  if (serverInstance) {
    serverInstance.close(() => {
      console.log('🏁 Express server closed.');
    });
  }
  
  try {
    const mongoose = require('mongoose');
    await mongoose.connection.close();
    console.log('🔌 MongoDB connection closed.');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error during MongoDB disconnection:', err.message);
    process.exit(1);
  }
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error.stack || error);
  process.exit(1);
});

startServer();

module.exports = app;
