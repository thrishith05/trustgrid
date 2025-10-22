const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class Database {
  constructor() {
    this.db = null;
  }

  initialize() {
    return new Promise((resolve, reject) => {
      const dbPath = process.env.DATABASE_URL || path.join(__dirname, '../civic_fix.db');
      
      this.db = new sqlite3.Database(dbPath.replace('sqlite:./', ''), (err) => {
        if (err) {
          console.error('Database connection error:', err);
          reject(err);
        } else {
          console.log('✅ Connected to SQLite database');
          this.createTables().then(resolve).catch(reject);
        }
      });
    });
  }

  createTables() {
    return new Promise((resolve, reject) => {
      this.db.serialize(() => {
        // Enable foreign keys
        this.db.run('PRAGMA foreign_keys = ON');

        // Enhanced Reports table with better geospatial support
        this.db.run(`CREATE TABLE IF NOT EXISTS reports (
          id TEXT PRIMARY KEY,
          type TEXT NOT NULL,
          severity TEXT NOT NULL CHECK(severity IN ('low', 'medium', 'high', 'critical')),
          status TEXT NOT NULL DEFAULT 'reported' CHECK(status IN ('reported', 'acknowledged', 'in_progress', 'resolved', 'closed', 'duplicate')),
          
          -- Location data
          latitude REAL NOT NULL,
          longitude REAL NOT NULL,
          address TEXT NOT NULL,
          location_accuracy REAL,
          
          -- Timestamps
          timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
          acknowledged_at DATETIME,
          in_progress_at DATETIME,
          resolved_at DATETIME,
          closed_at DATETIME,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          
          -- Content
          description TEXT,
          voice_note_path TEXT,
          image_path TEXT NOT NULL,
          perceptual_hash TEXT NOT NULL,
          
          -- Assignment
          assigned_department TEXT,
          assigned_to TEXT,
          priority INTEGER DEFAULT 0,
          
          -- Resolution
          resolution_notes TEXT,
          before_image_path TEXT,
          after_image_path TEXT,
          pof_image_path TEXT,
          pof_uploaded_at DATETIME,
          pof_verified BOOLEAN DEFAULT 0,
          
          -- Community engagement
          verification_count INTEGER DEFAULT 0,
          verified_by TEXT,
          upvotes INTEGER DEFAULT 0,
          civic_coins_awarded INTEGER DEFAULT 0,
          
          -- Reporter info
          reporter_id TEXT,
          reporter_anonymous BOOLEAN DEFAULT 1,
          
          -- Metadata
          ai_confidence REAL,
          ai_labels TEXT,
          duplicate_of TEXT,
          related_reports TEXT,
          
          FOREIGN KEY (duplicate_of) REFERENCES reports(id)
        )`);

        // Create spatial index simulation (SQLite doesn't have real spatial indexes)
        this.db.run(`CREATE INDEX IF NOT EXISTS idx_reports_location 
          ON reports(latitude, longitude)`);
        
        this.db.run(`CREATE INDEX IF NOT EXISTS idx_reports_status 
          ON reports(status, created_at DESC)`);
        
        this.db.run(`CREATE INDEX IF NOT EXISTS idx_reports_type 
          ON reports(type, status)`);
        
        this.db.run(`CREATE INDEX IF NOT EXISTS idx_reports_phash 
          ON reports(perceptual_hash)`);

        // Departments table
        this.db.run(`CREATE TABLE IF NOT EXISTS departments (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL UNIQUE,
          description TEXT,
          contact_email TEXT,
          contact_phone TEXT,
          avg_response_time INTEGER,
          total_resolved INTEGER DEFAULT 0,
          active BOOLEAN DEFAULT 1,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // Users table (for officials/admins)
        this.db.run(`CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          username TEXT NOT NULL UNIQUE,
          email TEXT NOT NULL UNIQUE,
          password_hash TEXT NOT NULL,
          role TEXT NOT NULL DEFAULT 'admin' CHECK(role IN ('admin', 'official', 'citizen')),
          department_id INTEGER,
          full_name TEXT,
          phone TEXT,
          active BOOLEAN DEFAULT 1,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          last_login DATETIME,
          FOREIGN KEY (department_id) REFERENCES departments (id)
        )`);

        // Verifications table (for community verification)
        this.db.run(`CREATE TABLE IF NOT EXISTS verifications (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          report_id TEXT NOT NULL,
          user_id TEXT,
          verification_type TEXT CHECK(verification_type IN ('upvote', 'verify', 'pof_confirm')),
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (report_id) REFERENCES reports(id),
          UNIQUE(report_id, user_id, verification_type)
        )`);

        // Activity log table
        this.db.run(`CREATE TABLE IF NOT EXISTS activity_log (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          report_id TEXT NOT NULL,
          user_id TEXT,
          action TEXT NOT NULL,
          details TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (report_id) REFERENCES reports(id)
        )`);

        // Duplicate clusters table
        this.db.run(`CREATE TABLE IF NOT EXISTS duplicate_clusters (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          parent_report_id TEXT NOT NULL,
          latitude REAL NOT NULL,
          longitude REAL NOT NULL,
          radius REAL NOT NULL,
          report_count INTEGER DEFAULT 1,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (parent_report_id) REFERENCES reports(id)
        )`);

        // Civic coins table
        this.db.run(`CREATE TABLE IF NOT EXISTS civic_coins (
          user_id TEXT PRIMARY KEY,
          current_balance INTEGER DEFAULT 0,
          total_earned INTEGER DEFAULT 0,
          total_spent INTEGER DEFAULT 0,
          last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // Coin transactions table
        this.db.run(`CREATE TABLE IF NOT EXISTS coin_transactions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id TEXT NOT NULL,
          report_id TEXT,
          voucher_id INTEGER,
          transaction_type TEXT NOT NULL CHECK(transaction_type IN ('earned', 'spent', 'bonus')),
          amount INTEGER NOT NULL,
          description TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES civic_coins(user_id),
          FOREIGN KEY (report_id) REFERENCES reports(id),
          FOREIGN KEY (voucher_id) REFERENCES vouchers(id)
        )`);

        // Vouchers table
        this.db.run(`CREATE TABLE IF NOT EXISTS vouchers (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          title TEXT NOT NULL,
          description TEXT,
          coin_cost INTEGER NOT NULL,
          voucher_type TEXT NOT NULL CHECK(voucher_type IN ('discount', 'service', 'privilege')),
          discount_percentage INTEGER,
          max_uses INTEGER DEFAULT 1,
          current_uses INTEGER DEFAULT 0,
          expiry_date DATETIME,
          active BOOLEAN DEFAULT 1,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // Voucher redemptions table
        this.db.run(`CREATE TABLE IF NOT EXISTS voucher_redemptions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id TEXT NOT NULL,
          voucher_id INTEGER NOT NULL,
          redemption_code TEXT NOT NULL UNIQUE,
          redeemed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES civic_coins(user_id),
          FOREIGN KEY (voucher_id) REFERENCES vouchers(id),
          UNIQUE(user_id, voucher_id)
        )`);

        // Insert default departments
        this.db.run(`INSERT OR IGNORE INTO departments (name, description, contact_email, contact_phone) VALUES 
          ('Public Works', 'Handles infrastructure issues like potholes and sidewalks', 'publicworks@city.gov', '+1-555-0101'),
          ('Sanitation', 'Manages trash collection and waste management', 'sanitation@city.gov', '+1-555-0102'),
          ('Utilities', 'Handles streetlights and water issues', 'utilities@city.gov', '+1-555-0103'),
          ('Parks & Recreation', 'Manages parks and public spaces', 'parks@city.gov', '+1-555-0104'),
          ('Transportation', 'Handles traffic signs and road safety', 'transport@city.gov', '+1-555-0105')
        `, (err) => {
          if (err) {
            console.error('Error inserting default departments:', err);
          } else {
            console.log('✅ Default departments inserted successfully');
          }
        });

        // Insert sample vouchers
        this.db.run(`INSERT OR IGNORE INTO vouchers (title, description, coin_cost, voucher_type, discount_percentage, max_uses, active) VALUES 
          ('City Museum Pass', 'Free entry to City Museum for one day', 20, 'service', 100, 1, 1),
          ('Public Transport Discount', '20% off on city bus/train tickets', 15, 'discount', 20, 5, 1),
          ('Library Premium Access', 'Extended library borrowing privileges', 10, 'privilege', 0, 1, 1),
          ('Parking Permit Discount', '50% off monthly parking permit', 25, 'discount', 50, 1, 1),
          ('Community Center Classes', 'Free access to fitness classes for a month', 30, 'service', 100, 1, 1),
          ('City Hall Tour', 'VIP guided tour of City Hall', 5, 'service', 100, 1, 1),
          ('Water Bill Discount', '15% off next water bill payment', 12, 'discount', 15, 3, 1),
          ('Recreation Center Pass', 'Free access to swimming pool for a week', 18, 'service', 100, 2, 1),
          ('Zoo Family Pass', 'Free family admission to City Zoo (up to 4 people)', 35, 'service', 100, 1, 1),
          ('Botanical Garden Pass', 'Free entry to Botanical Gardens for a month', 22, 'service', 100, 1, 1),
          ('Public WiFi Premium', 'Unlimited high-speed public WiFi for 3 months', 8, 'service', 100, 1, 1),
          ('Garbage Collection Fee Waiver', 'Waive next month garbage collection fee', 40, 'discount', 100, 1, 1),
          ('Senior Center Membership', 'Free membership to Senior Citizens Center', 28, 'service', 100, 1, 1),
          ('Park Maintenance Volunteer Badge', 'Official volunteer badge for park maintenance', 15, 'privilege', 0, 1, 1),
          ('Emergency Services Priority', 'Priority response for non-emergency city services', 50, 'privilege', 0, 1, 1),
          ('City Newsletter Premium', 'Premium city newsletter with exclusive updates', 3, 'service', 100, 1, 1),
          ('Public Meeting Front Row Seats', 'Reserved front row seats at city council meetings', 7, 'privilege', 0, 5, 1),
          ('City Services App Premium', 'Premium features in city services mobile app', 6, 'service', 100, 1, 1),
          ('Street Cleaning Schedule Priority', 'Priority scheduling for street cleaning requests', 20, 'privilege', 0, 3, 1),
          ('Mayor Office Hours Meeting', '15-minute private meeting with Mayor', 100, 'service', 100, 1, 1)
        `, (err) => {
          if (err) {
            console.error('Error inserting sample vouchers:', err);
          } else {
            console.log('✅ Sample vouchers inserted successfully');
          }
        });

        // Complete initialization
        console.log('✅ Database tables created successfully');
        resolve();
      });
    });
  }

  // Helper method to run queries with promises
  query(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  // Helper method to run single row queries
  get(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  // Helper method to run insert/update/delete
  run(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function(err) {
        if (err) reject(err);
        else resolve({ lastID: this.lastID, changes: this.changes });
      });
    });
  }

  close() {
    return new Promise((resolve, reject) => {
      if (this.db) {
        this.db.close((err) => {
          if (err) reject(err);
          else {
            console.log('✅ Database connection closed');
            resolve();
          }
        });
      } else {
        resolve();
      }
    });
  }
}

module.exports = new Database();

