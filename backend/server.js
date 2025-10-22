const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const sqlite3 = require('sqlite3').verbose();
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve static files from admin directory
app.use('/admin', express.static(path.join(__dirname, '../admin')));

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

// File upload configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads/';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}-${Date.now()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept image files or files without mime type (from mobile apps)
    if (!file.mimetype || file.mimetype.startsWith('image/') || file.originalname.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

// Database initialization
const db = new sqlite3.Database('civic_fix.db');

// Create tables
db.serialize(() => {
  // Reports table
  db.run(`CREATE TABLE IF NOT EXISTS reports (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    severity TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'reported',
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    address TEXT NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    description TEXT,
    voice_note_path TEXT,
    image_path TEXT NOT NULL,
    perceptual_hash TEXT NOT NULL,
    assigned_department TEXT,
    assigned_to TEXT,
    acknowledged_at DATETIME,
    resolved_at DATETIME,
    resolution_notes TEXT,
    before_image_path TEXT,
    after_image_path TEXT,
    verification_count INTEGER DEFAULT 0,
    verified_by TEXT,
    civic_coins_awarded INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Departments table
  db.run(`CREATE TABLE IF NOT EXISTS departments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    contact_email TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Users table (for admin dashboard)
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'admin',
    department_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (department_id) REFERENCES departments (id)
  )`);

  // Insert default departments
  db.run(`INSERT OR IGNORE INTO departments (name, description, contact_email) VALUES 
    ('Public Works', 'Handles infrastructure issues like potholes and sidewalks', 'publicworks@city.gov'),
    ('Sanitation', 'Manages trash collection and waste management', 'sanitation@city.gov'),
    ('Utilities', 'Handles streetlights and water issues', 'utilities@city.gov'),
    ('Parks & Recreation', 'Manages parks and public spaces', 'parks@city.gov')
  `);
});

// Routes

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Get all reports
app.get('/api/reports', (req, res) => {
  const { status, type, limit = 50, offset = 0 } = req.query;
  
  let query = 'SELECT * FROM reports';
  const params = [];
  const conditions = [];

  if (status) {
    conditions.push('status = ?');
    params.push(status);
  }

  if (type) {
    conditions.push('type = ?');
    params.push(type);
  }

  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }

  query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), parseInt(offset));

  db.all(query, params, (err, rows) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    res.json(rows);
  });
});

// Get report by ID
app.get('/api/reports/:id', (req, res) => {
  const { id } = req.params;
  
  db.get('SELECT * FROM reports WHERE id = ?', [id], (err, row) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    
    if (!row) {
      return res.status(404).json({ error: 'Report not found' });
    }
    
    res.json(row);
  });
});

// Create new report
app.post('/api/reports', upload.single('image'), (req, res) => {
  console.log('Received POST /api/reports');
  console.log('Body:', req.body);
  console.log('File:', req.file ? 'Present' : 'Missing');
  
  const {
    type,
    severity,
    latitude,
    longitude,
    address,
    description,
    perceptual_hash
  } = req.body;

  if (!type || !severity || !latitude || !longitude || !address || !perceptual_hash) {
    console.log('Missing required fields:', { type, severity, latitude, longitude, address, perceptual_hash });
    return res.status(400).json({ error: 'Missing required fields' });
  }

  if (!req.file) {
    console.log('Image file is missing');
    return res.status(400).json({ error: 'Image file is required' });
  }

  const reportId = uuidv4();
  const imagePath = req.file.path;
  
  console.log('Creating report:', reportId);

  const query = `
    INSERT INTO reports (
      id, type, severity, latitude, longitude, address, 
      description, image_path, perceptual_hash, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'reported')
  `;

  const params = [
    reportId, type, severity, parseFloat(latitude), parseFloat(longitude),
    address, description || null, imagePath, perceptual_hash
  ];

  db.run(query, params, function(err) {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Database error', details: err.message });
    }

    console.log('Report created successfully:', reportId);
    res.status(201).json({
      id: reportId,
      message: 'Report created successfully',
      status: 'reported'
    });
  });
});

// Update report status
app.patch('/api/reports/:id/status', (req, res) => {
  const { id } = req.params;
  const { status, resolution_notes, assigned_department, assigned_to } = req.body;

  if (!status) {
    return res.status(400).json({ error: 'Status is required' });
  }

  const validStatuses = ['reported', 'acknowledged', 'in_progress', 'resolved', 'closed'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  let query = 'UPDATE reports SET status = ?, updated_at = CURRENT_TIMESTAMP';
  const params = [status];

  if (status === 'acknowledged') {
    query += ', acknowledged_at = CURRENT_TIMESTAMP';
  }

  if (status === 'resolved') {
    query += ', resolved_at = CURRENT_TIMESTAMP';
  }

  if (resolution_notes) {
    query += ', resolution_notes = ?';
    params.push(resolution_notes);
  }

  if (assigned_department) {
    query += ', assigned_department = ?';
    params.push(assigned_department);
  }

  if (assigned_to) {
    query += ', assigned_to = ?';
    params.push(assigned_to);
  }

  query += ' WHERE id = ?';
  params.push(id);

  db.run(query, params, function(err) {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Database error' });
    }

    if (this.changes === 0) {
      return res.status(404).json({ error: 'Report not found' });
    }

    res.json({ message: 'Report status updated successfully' });
  });
});

// Check for duplicate reports
app.post('/api/duplicates', (req, res) => {
  const { perceptual_hash, latitude, longitude, radius = 100 } = req.body;

  if (!perceptual_hash || !latitude || !longitude) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  // Find reports within radius
  const query = `
    SELECT id, perceptual_hash, latitude, longitude,
           (6371000 * acos(cos(radians(?)) * cos(radians(latitude)) * 
            cos(radians(longitude) - radians(?)) + sin(radians(?)) * 
            sin(radians(latitude)))) AS distance
    FROM reports 
    WHERE distance < ?
    ORDER BY distance
  `;

  db.all(query, [latitude, longitude, latitude, radius], (err, rows) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Database error' });
    }

    // Check perceptual hash similarity
    const duplicates = rows.filter(row => {
      const similarity = calculateHashSimilarity(perceptual_hash, row.perceptual_hash);
      return similarity >= 80; // 80% similarity threshold
    });

    res.json({
      is_duplicate: duplicates.length > 0,
      similar_reports: duplicates,
      count: duplicates.length
    });
  });
});

// Get statistics
app.get('/api/stats', (req, res) => {
  const queries = {
    total: 'SELECT COUNT(*) as count FROM reports',
    resolved: 'SELECT COUNT(*) as count FROM reports WHERE status = "resolved"',
    pending: 'SELECT COUNT(*) as count FROM reports WHERE status IN ("reported", "acknowledged", "in_progress")',
    critical: 'SELECT COUNT(*) as count FROM reports WHERE severity = "critical"',
    byType: 'SELECT type, COUNT(*) as count FROM reports GROUP BY type',
    byStatus: 'SELECT status, COUNT(*) as count FROM reports GROUP BY status'
  };

  const results = {};
  let completed = 0;
  const totalQueries = Object.keys(queries).length;

  Object.entries(queries).forEach(([key, query]) => {
    db.all(query, [], (err, rows) => {
      if (err) {
        console.error(`Error in ${key} query:`, err);
        results[key] = { error: 'Database error' };
      } else {
        results[key] = rows;
      }

      completed++;
      if (completed === totalQueries) {
        res.json(results);
      }
    });
  });
});

// Get departments
app.get('/api/departments', (req, res) => {
  db.all('SELECT * FROM departments ORDER BY name', [], (err, rows) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    res.json(rows);
  });
});

// Helper function to calculate hash similarity
function calculateHashSimilarity(hash1, hash2) {
  if (hash1.length !== hash2.length) return 0;
  
  let similarity = 0;
  for (let i = 0; i < hash1.length; i++) {
    if (hash1[i] === hash2[i]) similarity++;
  }
  
  return (similarity / hash1.length) * 100;
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File too large' });
    }
  }
  
  res.status(500).json({ error: 'Internal server error' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Start server
app.listen(PORT, () => {
  console.log(`CivicFix API server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down server...');
  db.close((err) => {
    if (err) {
      console.error('Error closing database:', err);
    } else {
      console.log('Database connection closed.');
    }
    process.exit(0);
  });
});

module.exports = app;
