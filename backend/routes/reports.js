const express = require('express');
const router = express.Router();
const database = require('../config/database');
const storage = require('../config/storage');
const duplicateDetection = require('../services/duplicateDetection');
const { v4: uuidv4 } = require('uuid');

// Configure multer
const upload = storage.getMulterConfig();

/**
 * GET /api/reports
 * Get all reports with filtering and pagination
 */
router.get('/', async (req, res) => {
  try {
    const {
      status,
      type,
      severity,
      department,
      limit = 50,
      offset = 0,
      sortBy = 'created_at',
      sortOrder = 'DESC'
    } = req.query;

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

    if (severity) {
      conditions.push('severity = ?');
      params.push(severity);
    }

    if (department) {
      conditions.push('assigned_department = ?');
      params.push(department);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    // Validate sortBy to prevent SQL injection
    const validSortFields = ['created_at', 'updated_at', 'severity', 'status', 'upvotes'];
    const sortField = validSortFields.includes(sortBy) ? sortBy : 'created_at';
    const order = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    query += ` ORDER BY ${sortField} ${order} LIMIT ? OFFSET ?`;
    params.push(parseInt(limit), parseInt(offset));

    const reports = await database.query(query, params);
    
    res.json({
      success: true,
      count: reports.length,
      reports
    });
  } catch (error) {
    console.error('Error fetching reports:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch reports' });
  }
});

/**
 * GET /api/reports/:id
 * Get single report by ID
 */
router.get('/:id', async (req, res) => {
  try {
    const report = await database.get('SELECT * FROM reports WHERE id = ?', [req.params.id]);
    
    if (!report) {
      return res.status(404).json({ success: false, error: 'Report not found' });
    }

    // Get related reports if this is a duplicate cluster parent
    const relatedReports = await database.query(
      'SELECT * FROM reports WHERE duplicate_of = ?',
      [req.params.id]
    );

    res.json({
      success: true,
      report,
      relatedReports
    });
  } catch (error) {
    console.error('Error fetching report:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch report' });
  }
});

/**
 * POST /api/reports
 * Create new report with duplicate detection
 */
router.post('/', upload.single('image'), async (req, res) => {
  try {
    console.log('📥 Received POST /api/reports');
    console.log('Body:', req.body);
    console.log('File:', req.file ? 'Present' : 'Missing');

    const {
      type,
      severity,
      latitude,
      longitude,
      address,
      description,
      perceptual_hash,
      ai_confidence,
      ai_labels,
      reporter_anonymous = true
    } = req.body;

    // Validation
    if (!type || !severity || !latitude || !longitude || !address || !perceptual_hash) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required fields',
        required: ['type', 'severity', 'latitude', 'longitude', 'address', 'perceptual_hash']
      });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, error: 'Image file is required' });
    }

    const reportId = uuidv4();
    // Store relative path, not absolute path
    const imagePath = req.file.path.replace(/^.*\/uploads\//, 'uploads/');

    // Check for duplicates
    const duplicateCheck = await duplicateDetection.checkAndMarkDuplicate(
      reportId,
      perceptual_hash,
      parseFloat(latitude),
      parseFloat(longitude)
    );

    const reportStatus = duplicateCheck.isDuplicate ? 'duplicate' : 'reported';

    // Insert report
    const query = `
      INSERT INTO reports (
        id, type, severity, status, latitude, longitude, address,
        description, image_path, perceptual_hash, ai_confidence,
        ai_labels, reporter_anonymous, duplicate_of
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const params = [
      reportId, type, severity, reportStatus,
      parseFloat(latitude), parseFloat(longitude), address,
      description || null, imagePath, perceptual_hash,
      ai_confidence ? parseFloat(ai_confidence) : null,
      ai_labels || null, reporter_anonymous === 'true' || reporter_anonymous === true,
      duplicateCheck.duplicateOf || null
    ];

    await database.run(query, params);

    // Log activity
    await database.run(
      'INSERT INTO activity_log (report_id, action, details) VALUES (?, ?, ?)',
      [reportId, 'created', `Report created with status: ${reportStatus}`]
    );

    console.log(`✅ Report created successfully: ${reportId} (${reportStatus})`);

    // Send real-time notification
    if (global.notifications) {
      const reportData = {
        id: reportId,
        type, severity, status: reportStatus,
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        address
      };
      
      if (duplicateCheck.isDuplicate) {
        global.notifications.notifyDuplicateDetected(reportId, duplicateCheck.duplicateOf, duplicateCheck.matchScore);
      } else {
        global.notifications.notifyNewReport(reportData);
      }
    }

    res.status(201).json({
      success: true,
      id: reportId,
      status: reportStatus,
      message: duplicateCheck.isDuplicate 
        ? `Report marked as duplicate of ${duplicateCheck.duplicateOf}`
        : 'Report created successfully',
      duplicateInfo: duplicateCheck.isDuplicate ? {
        duplicateOf: duplicateCheck.duplicateOf,
        matchScore: duplicateCheck.matchScore
      } : null
    });

  } catch (error) {
    console.error('Error creating report:', error);
    res.status(500).json({ success: false, error: 'Failed to create report', details: error.message });
  }
});

/**
 * PATCH /api/reports/:id/status
 * Update report status
 */
router.patch('/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, resolution_notes, assigned_department, assigned_to } = req.body;

    if (!status) {
      return res.status(400).json({ success: false, error: 'Status is required' });
    }

    const validStatuses = ['reported', 'acknowledged', 'in_progress', 'resolved', 'closed', 'duplicate'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid status' });
    }

    let query = 'UPDATE reports SET status = ?, updated_at = CURRENT_TIMESTAMP';
    const params = [status];

    // Set timestamp fields based on status
    if (status === 'acknowledged') {
      query += ', acknowledged_at = CURRENT_TIMESTAMP';
    } else if (status === 'in_progress') {
      query += ', in_progress_at = CURRENT_TIMESTAMP';
    } else if (status === 'resolved') {
      query += ', resolved_at = CURRENT_TIMESTAMP';
    } else if (status === 'closed') {
      query += ', closed_at = CURRENT_TIMESTAMP';
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

    const result = await database.run(query, params);

    if (result.changes === 0) {
      return res.status(404).json({ success: false, error: 'Report not found' });
    }

    // Log activity
    await database.run(
      'INSERT INTO activity_log (report_id, action, details) VALUES (?, ?, ?)',
      [id, 'status_updated', `Status changed to: ${status}`]
    );

    // Send real-time notification
    if (global.notifications) {
      const oldReport = await database.get('SELECT status FROM reports WHERE id = ?', [id]);
      global.notifications.notifyStatusChange(id, oldReport?.status, status, {
        assigned_department,
        assigned_to,
        resolution_notes
      });
    }

    res.json({ success: true, message: 'Report status updated successfully' });

  } catch (error) {
    console.error('Error updating report status:', error);
    res.status(500).json({ success: false, error: 'Failed to update report status' });
  }
});

/**
 * POST /api/reports/:id/pof
 * Upload Proof of Fix (PoF) image with civic coins reward - marks report as RESOLVED
 */
router.post('/:id/pof', upload.single('pof_image'), async (req, res) => {
  try {
    const { id } = req.params;
    const { resolution_notes = '', civic_coins = 10 } = req.body;

    if (!req.file) {
      return res.status(400).json({ success: false, error: 'PoF image is required' });
    }

    const report = await database.get('SELECT * FROM reports WHERE id = ?', [id]);
    
    if (!report) {
      return res.status(404).json({ success: false, error: 'Report not found' });
    }

    // Store relative path, not absolute path
    const pofImagePath = req.file.path.replace(/^.*\/uploads\//, 'uploads/');

    // Update report with proof of fix and mark as RESOLVED
    await database.run(
      `UPDATE reports SET 
        pof_image_path = ?,
        pof_uploaded_at = CURRENT_TIMESTAMP,
        pof_verified = 1,
        status = 'resolved',
        resolved_at = CURRENT_TIMESTAMP,
        resolution_notes = ?,
        civic_coins_awarded = ?,
        after_image_path = ?,
        updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [pofImagePath, resolution_notes, civic_coins, pofImagePath, id]
    );

    // Award civic coins to the reporter
    // Use reporter_id if available, otherwise use a default anonymous user ID
    const userId = report.reporter_id || report.user_id || `report_${id}`;
    
    console.log(`💰 Awarding ${civic_coins} coins to user: ${userId}`);
    console.log(`Report details: reporter_id=${report.reporter_id}, user_id=${report.user_id}`);
    
    // Update or create civic coins record
    try {
      const result = await database.run(`
        INSERT OR REPLACE INTO civic_coins (
          user_id, 
          current_balance, 
          total_earned, 
          last_updated
        ) VALUES (
          ?, 
          COALESCE((SELECT current_balance FROM civic_coins WHERE user_id = ?), 0) + ?,
          COALESCE((SELECT total_earned FROM civic_coins WHERE user_id = ?), 0) + ?,
          CURRENT_TIMESTAMP
        )
      `, [userId, userId, civic_coins, userId, civic_coins]);
      console.log(`✅ Civic coins record created/updated: ${JSON.stringify(result)}`);
    } catch (error) {
      console.error(`❌ Error updating civic coins:`, error);
      throw error;
    }

    // Log the coin transaction
    try {
      const result = await database.run(`
        INSERT INTO coin_transactions (
          user_id,
          report_id,
          transaction_type,
          amount,
          description,
          created_at
        ) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `, [userId, id, 'earned', civic_coins, `Report resolved - proof of fix provided: ${resolution_notes || 'No notes'}`]);
      console.log(`✅ Transaction logged: ${JSON.stringify(result)}`);
    } catch (error) {
      console.error(`❌ Error logging transaction:`, error);
      throw error;
    }

    // Update the report with the user_id if it was missing
    if (!report.reporter_id) {
      await database.run('UPDATE reports SET reporter_id = ? WHERE id = ?', [userId, id]);
      console.log(`✅ Updated report with reporter_id: ${userId}`);
    }

    // Log resolution activity
    await database.run(
      'INSERT INTO activity_log (report_id, user_id, action, details) VALUES (?, ?, ?, ?)',
      [id, 'admin', 'resolved_with_pof', JSON.stringify({ 
        pof_image: pofImagePath, 
        resolution_notes, 
        civic_coins_awarded: civic_coins,
        resolved_at: new Date().toISOString(),
        report_type: report.type,
        report_location: report.address
      })]
    );

    console.log(`✅ PoF uploaded for report ${id} - Marked as RESOLVED - Awarded ${civic_coins} civic coins`);

    // Send real-time notification
    if (global.notifications) {
      global.notifications.broadcast({
        type: 'report_resolved',
        reportId: id,
        data: {
          report,
          pofImagePath,
          resolutionNotes: resolution_notes,
          civicCoinsAwarded: civic_coins,
          resolvedAt: new Date().toISOString()
        },
        timestamp: new Date().toISOString()
      });
    }

    res.json({
      success: true,
      message: 'Proof of Fix uploaded successfully - Report marked as RESOLVED',
      data: {
        pof_image_path: pofImagePath,
        civic_coins_awarded: civic_coins,
        resolution_notes: resolution_notes,
        status: 'resolved',
        resolved_at: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Error uploading PoF:', error);
    res.status(500).json({ success: false, error: 'Failed to upload Proof of Fix' });
  }
});

/**
 * POST /api/reports/:id/verify
 * Community verification/upvote
 */
router.post('/:id/verify', async (req, res) => {
  try {
    const { id } = req.params;
    const { user_id, verification_type = 'upvote' } = req.body;

    const report = await database.get('SELECT * FROM reports WHERE id = ?', [id]);
    
    if (!report) {
      return res.status(404).json({ success: false, error: 'Report not found' });
    }

    // Check if user already verified
    const existing = await database.get(
      'SELECT * FROM verifications WHERE report_id = ? AND user_id = ? AND verification_type = ?',
      [id, user_id || 'anonymous', verification_type]
    );

    if (existing) {
      return res.status(400).json({ success: false, error: 'Already verified by this user' });
    }

    // Add verification
    await database.run(
      'INSERT INTO verifications (report_id, user_id, verification_type) VALUES (?, ?, ?)',
      [id, user_id || 'anonymous', verification_type]
    );

    // Update report counts
    let newCount = 0;
    if (verification_type === 'upvote') {
      await database.run(
        'UPDATE reports SET upvotes = upvotes + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [id]
      );
      const updated = await database.get('SELECT upvotes FROM reports WHERE id = ?', [id]);
      newCount = updated.upvotes;
    } else if (verification_type === 'verify') {
      await database.run(
        'UPDATE reports SET verification_count = verification_count + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [id]
      );
      const updated = await database.get('SELECT verification_count FROM reports WHERE id = ?', [id]);
      newCount = updated.verification_count;
    } else if (verification_type === 'pof_confirm') {
      await database.run(
        'UPDATE reports SET pof_verified = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [id]
      );
      newCount = 1;
    }

    // Send real-time notification
    if (global.notifications) {
      global.notifications.notifyVerification(id, verification_type, newCount);
    }

    res.json({
      success: true,
      message: `${verification_type} recorded successfully`
    });

  } catch (error) {
    console.error('Error recording verification:', error);
    res.status(500).json({ success: false, error: 'Failed to record verification' });
  }
});

/**
 * POST /api/reports/:id/upvote
 * Upvote a report (shorthand for verify with type=upvote)
 */
router.post('/:id/upvote', async (req, res) => {
  req.body.verification_type = 'upvote';
  return router.stack.find(r => r.route.path === '/:id/verify').route.stack[0].handle(req, res);
});

/**
 * DELETE /api/reports/:id
 * Delete a report (admin only)
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { reason = 'Admin decision' } = req.body;

    console.log(`🗑️ Admin deleting report: ${id}, reason: ${reason}`);

    // Check if report exists
    const report = await database.get('SELECT * FROM reports WHERE id = ?', [id]);
    
    if (!report) {
      return res.status(404).json({ success: false, error: 'Report not found' });
    }

    // Disable foreign key constraints temporarily
    await database.run('PRAGMA foreign_keys = OFF');

    try {
      // Delete related verifications first
      await database.run('DELETE FROM verifications WHERE report_id = ?', [id]);

      // Delete related activity logs
      await database.run('DELETE FROM activity_log WHERE report_id = ?', [id]);

      // Delete the report
      const deleteResult = await database.run('DELETE FROM reports WHERE id = ?', [id]);
      
      if (deleteResult.changes === 0) {
        return res.status(404).json({ success: false, error: 'Report not found' });
      }

      // Log the deletion (without foreign key constraint)
      await database.run(`
        INSERT INTO activity_log (report_id, user_id, action, details)
        VALUES (?, ?, ?, ?)
      `, [id, 'admin', 'deleted', JSON.stringify({ reason, deleted_at: new Date().toISOString() })]);

    } finally {
      // Re-enable foreign key constraints
      await database.run('PRAGMA foreign_keys = ON');
    }

    console.log(`✅ Report ${id} deleted successfully`);

    // Send real-time notification
    if (global.notifications) {
      global.notifications.broadcast({
        type: 'report_deleted',
        reportId: id,
        data: {
          report,
          reason,
          deletedAt: new Date().toISOString()
        },
        timestamp: new Date().toISOString()
      });
    }

    res.json({
      success: true,
      message: 'Report deleted successfully',
      deletedReport: {
        id: report.id,
        type: report.type,
        reason
      }
    });

  } catch (error) {
    console.error('Error deleting report:', error);
    // Ensure foreign keys are re-enabled even if there's an error
    await database.run('PRAGMA foreign_keys = ON').catch(() => {});
    res.status(500).json({ success: false, error: 'Failed to delete report' });
  }
});

module.exports = router;

