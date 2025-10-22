require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const path = require('path');
const rateLimit = require('express-rate-limit');

// Import configuration and services
const database = require('./config/database');
const storage = require('./config/storage');
const notifications = require('./services/notifications');

// Import routes
const reportsRouter = require('./routes/reports');
const duplicatesRouter = require('./routes/duplicates');
const statsRouter = require('./routes/stats');
const civicCoinsRouter = require('./routes/civic-coins');
const vouchersRouter = require('./routes/vouchers');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware - Disable CSP in development for easier admin panel
if (process.env.NODE_ENV === 'production') {
  app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" }
  }));
} else {
  // Development mode: Disable CSP to allow CDN resources
  app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" }
  }));
  console.log('⚠️  CSP disabled for development (allows CDN resources)');
}
app.use(cors());
app.use(morgan('combined'));
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static files
app.use('/admin', express.static(path.join(__dirname, '../admin')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: { success: false, error: 'Too many requests, please try again later.' }
});
app.use('/api/', limiter);

// Request logging
app.use((req, res, next) => {
  if (req.method !== 'GET') {
    console.log(`\n📨 ${req.method} ${req.path}`);
    if (req.body && Object.keys(req.body).length > 0) {
      console.log('Body:', req.body);
    }
  }
  next();
});

// Routes
app.get('/health', (req, res) => {
  res.json({
    success: true,
    status: 'OK',
    timestamp: new Date().toISOString(),
    version: '2.0.0',
    database: database.db ? 'connected' : 'disconnected',
    storage: storage.storageType,
    websockets: notifications.getStats()
  });
});

// API Routes
app.use('/api/reports', reportsRouter);
app.use('/api/duplicates', duplicatesRouter);
app.use('/api/stats', statsRouter);
app.use('/api/civic-coins', civicCoinsRouter);
app.use('/api/vouchers', vouchersRouter);

// Departments API
app.get('/api/departments', async (req, res) => {
  try {
    const departments = await database.query('SELECT * FROM departments WHERE active = 1 ORDER BY name');
    res.json({ success: true, departments });
  } catch (error) {
    console.error('Error fetching departments:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch departments' });
  }
});

// Activity log API
app.get('/api/activity', async (req, res) => {
  try {
    const { report_id, limit = 50 } = req.query;
    
    let query = 'SELECT * FROM activity_log';
    const params = [];

    if (report_id) {
      query += ' WHERE report_id = ?';
      params.push(report_id);
    }

    query += ' ORDER BY created_at DESC LIMIT ?';
    params.push(parseInt(limit));

    const activities = await database.query(query, params);
    res.json({ success: true, activities });

  } catch (error) {
    console.error('Error fetching activity log:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch activity log' });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('❌ Error:', err);
  
  if (err.name === 'MulterError') {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        error: 'File too large',
        maxSize: process.env.MAX_FILE_SIZE || '10MB'
      });
    }
  }
  
  res.status(500).json({
    success: false,
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found',
    path: req.path
  });
});

// Initialize and start server
async function startServer() {
  try {
    // Initialize database
    console.log('🔄 Initializing database...');
    await database.initialize();

    // Start HTTP server
    const server = app.listen(PORT, () => {
      console.log('\n🚀 ========================================');
      console.log(`   CivicFix API Server v2.0 RUNNING`);
      console.log('   ========================================');
      console.log(`   📡 Server:    http://localhost:${PORT}`);
      console.log(`   ❤️  Health:    http://localhost:${PORT}/health`);
      console.log(`   🖥️  Admin:     http://localhost:${PORT}/admin/index.html`);
      console.log(`   💾 Database:  ${database.db ? 'Connected' : 'Not connected'}`);
      console.log(`   📁 Storage:   ${storage.storageType.toUpperCase()}`);
      console.log(`   🌍 Env:       ${process.env.NODE_ENV || 'development'}`);
      
      // Initialize WebSocket server
      notifications.initialize(server);
      const wsStatus = notifications.isEnabled ? 'ENABLED (ws://localhost:' + PORT + '/ws)' : 'DISABLED';
      console.log(`   🔔 WebSocket: ${wsStatus}`);
      
      console.log('   ========================================\n');
    });

    // Make server and notifications available globally
    global.httpServer = server;
    global.notifications = notifications;

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
async function gracefulShutdown(signal) {
  console.log(`\n⚠️  Received ${signal}, shutting down gracefully...`);
  
  try {
    await database.close();
    console.log('✅ Server shut down successfully');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during shutdown:', error);
    process.exit(1);
  }
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// Start the server
startServer();

module.exports = app;

