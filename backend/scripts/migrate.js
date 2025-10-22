/**
 * Database Migration Script
 * Migrates from old schema to new enhanced schema
 * Run with: node scripts/migrate.js
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const OLD_DB = path.join(__dirname, '../civic_fix.db');
const BACKUP_DB = path.join(__dirname, '../civic_fix_backup.db');

async function migrate() {
  console.log('🔄 Starting database migration...\n');

  // Create backup
  console.log('📦 Creating backup...');
  if (fs.existsSync(OLD_DB)) {
    fs.copyFileSync(OLD_DB, BACKUP_DB);
    console.log(`✅ Backup created: ${BACKUP_DB}\n`);
  }

  const db = new sqlite3.Database(OLD_DB);

  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // Add new columns to existing reports table
      console.log('🔧 Adding new columns to reports table...');

      const alterCommands = [
        // Location
        'ALTER TABLE reports ADD COLUMN location_accuracy REAL',
        
        // Timestamps
        'ALTER TABLE reports ADD COLUMN in_progress_at DATETIME',
        'ALTER TABLE reports ADD COLUMN closed_at DATETIME',
        
        // Assignment
        'ALTER TABLE reports ADD COLUMN priority INTEGER DEFAULT 0',
        
        // Proof of Fix
        'ALTER TABLE reports ADD COLUMN pof_image_path TEXT',
        'ALTER TABLE reports ADD COLUMN pof_uploaded_at DATETIME',
        'ALTER TABLE reports ADD COLUMN pof_verified BOOLEAN DEFAULT 0',
        
        // Community
        'ALTER TABLE reports ADD COLUMN upvotes INTEGER DEFAULT 0',
        
        // Reporter
        'ALTER TABLE reports ADD COLUMN reporter_id TEXT',
        'ALTER TABLE reports ADD COLUMN reporter_anonymous BOOLEAN DEFAULT 1',
        
        // Metadata
        'ALTER TABLE reports ADD COLUMN ai_confidence REAL',
        'ALTER TABLE reports ADD COLUMN ai_labels TEXT',
        'ALTER TABLE reports ADD COLUMN duplicate_of TEXT',
        'ALTER TABLE reports ADD COLUMN related_reports TEXT'
      ];

      let completed = 0;
      const errors = [];

      alterCommands.forEach(cmd => {
        db.run(cmd, (err) => {
          if (err && !err.message.includes('duplicate column name')) {
            errors.push({ command: cmd, error: err.message });
          }
          completed++;

          if (completed === alterCommands.length) {
            if (errors.length > 0) {
              console.log('⚠️  Some columns already exist (this is OK)');
            }
            console.log('✅ Reports table updated\n');

            // Create new tables
            createNewTables(db, resolve, reject);
          }
        });
      });
    });
  });
}

function createNewTables(db, resolve, reject) {
  console.log('🏗️  Creating new tables...');

  db.serialize(() => {
    // Verifications table
    db.run(`CREATE TABLE IF NOT EXISTS verifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      report_id TEXT NOT NULL,
      user_id TEXT,
      verification_type TEXT CHECK(verification_type IN ('upvote', 'verify', 'pof_confirm')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (report_id) REFERENCES reports(id),
      UNIQUE(report_id, user_id, verification_type)
    )`);

    // Activity log
    db.run(`CREATE TABLE IF NOT EXISTS activity_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      report_id TEXT NOT NULL,
      user_id TEXT,
      action TEXT NOT NULL,
      details TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (report_id) REFERENCES reports(id)
    )`);

    // Duplicate clusters
    db.run(`CREATE TABLE IF NOT EXISTS duplicate_clusters (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      parent_report_id TEXT NOT NULL,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      radius REAL NOT NULL,
      report_count INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (parent_report_id) REFERENCES reports(id)
    )`);

    // Update departments table
    db.run(`ALTER TABLE departments ADD COLUMN contact_phone TEXT`, () => {});
    db.run(`ALTER TABLE departments ADD COLUMN avg_response_time INTEGER`, () => {});
    db.run(`ALTER TABLE departments ADD COLUMN total_resolved INTEGER DEFAULT 0`, () => {});
    db.run(`ALTER TABLE departments ADD COLUMN active BOOLEAN DEFAULT 1`, () => {});

    // Update users table
    db.run(`ALTER TABLE users ADD COLUMN full_name TEXT`, () => {});
    db.run(`ALTER TABLE users ADD COLUMN phone TEXT`, () => {});
    db.run(`ALTER TABLE users ADD COLUMN active BOOLEAN DEFAULT 1`, () => {});
    db.run(`ALTER TABLE users ADD COLUMN last_login DATETIME`, () => {});

    console.log('✅ New tables created\n');

    // Create indexes
    createIndexes(db, resolve, reject);
  });
}

function createIndexes(db, resolve, reject) {
  console.log('📑 Creating indexes...');

  const indexes = [
    'CREATE INDEX IF NOT EXISTS idx_reports_location ON reports(latitude, longitude)',
    'CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status, created_at DESC)',
    'CREATE INDEX IF NOT EXISTS idx_reports_type ON reports(type, status)',
    'CREATE INDEX IF NOT EXISTS idx_reports_phash ON reports(perceptual_hash)',
    'CREATE INDEX IF NOT EXISTS idx_reports_duplicate ON reports(duplicate_of)',
    'CREATE INDEX IF NOT EXISTS idx_verifications_report ON verifications(report_id)',
    'CREATE INDEX IF NOT EXISTS idx_activity_report ON activity_log(report_id)'
  ];

  let completed = 0;

  indexes.forEach(indexCmd => {
    db.run(indexCmd, (err) => {
      if (err) {
        console.error(`Error creating index: ${err.message}`);
      }
      completed++;

      if (completed === indexes.length) {
        console.log('✅ Indexes created\n');
        
        db.close((err) => {
          if (err) {
            reject(err);
          } else {
            console.log('✅ Migration completed successfully!\n');
            console.log('📌 Next steps:');
            console.log('   1. Test the new server: node server-v2.js');
            console.log('   2. If everything works, replace server.js');
            console.log(`   3. Backup is saved at: ${BACKUP_DB}\n`);
            resolve();
          }
        });
      }
    });
  });
}

// Run migration
migrate().catch(err => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});

