const express = require('express');
const router = express.Router();
const database = require('../config/database');

/**
 * GET /api/stats
 * Get comprehensive statistics
 */
router.get('/', async (req, res) => {
  try {
    const stats = {};

    // Total reports
    const total = await database.get('SELECT COUNT(*) as count FROM reports');
    stats.total = total.count;

    // By status
    const byStatus = await database.query('SELECT status, COUNT(*) as count FROM reports GROUP BY status');
    stats.byStatus = byStatus;

    // Calculate specific statuses
    stats.resolved = byStatus.find(s => s.status === 'resolved')?.count || 0;
    stats.pending = byStatus.filter(s => ['reported', 'acknowledged', 'in_progress'].includes(s.status))
      .reduce((sum, s) => sum + s.count, 0);
    stats.duplicates = byStatus.find(s => s.status === 'duplicate')?.count || 0;

    // By type
    const byType = await database.query('SELECT type, COUNT(*) as count FROM reports GROUP BY type');
    stats.byType = byType;

    // By severity
    const bySeverity = await database.query('SELECT severity, COUNT(*) as count FROM reports GROUP BY severity');
    stats.bySeverity = bySeverity;
    stats.critical = bySeverity.find(s => s.severity === 'critical')?.count || 0;

    // By department
    const byDepartment = await database.query(
      'SELECT assigned_department, COUNT(*) as count FROM reports WHERE assigned_department IS NOT NULL GROUP BY assigned_department'
    );
    stats.byDepartment = byDepartment;

    // Recent activity (last 7 days)
    const recentStats = await database.get(`
      SELECT COUNT(*) as count
      FROM reports
      WHERE created_at >= datetime('now', '-7 days')
    `);
    stats.recentReports = recentStats.count;

    // Average resolution time (in hours)
    const avgResolution = await database.get(`
      SELECT AVG((julianday(resolved_at) - julianday(created_at)) * 24) as avg_hours
      FROM reports
      WHERE resolved_at IS NOT NULL
    `);
    stats.avgResolutionTime = avgResolution.avg_hours ? Math.round(avgResolution.avg_hours * 10) / 10 : null;

    // Top verified reports
    const topVerified = await database.query(`
      SELECT id, type, address, verification_count, upvotes
      FROM reports
      WHERE verification_count > 0 OR upvotes > 0
      ORDER BY (verification_count + upvotes) DESC
      LIMIT 5
    `);
    stats.topVerified = topVerified;

    // Most common issue type
    const mostCommon = await database.get(`
      SELECT type, COUNT(*) as count
      FROM reports
      GROUP BY type
      ORDER BY count DESC
      LIMIT 1
    `);
    stats.mostCommonIssue = mostCommon;

    res.json({
      success: true,
      stats
    });

  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch statistics'
    });
  }
});

/**
 * GET /api/stats/heatmap
 * Get data for heatmap visualization
 */
router.get('/heatmap', async (req, res) => {
  try {
    const { type, status } = req.query;

    let query = 'SELECT latitude, longitude, severity FROM reports';
    const params = [];
    const conditions = [];

    if (type) {
      conditions.push('type = ?');
      params.push(type);
    }

    if (status) {
      conditions.push('status = ?');
      params.push(status);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    const points = await database.query(query, params);

    res.json({
      success: true,
      count: points.length,
      points
    });

  } catch (error) {
    console.error('Error fetching heatmap data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch heatmap data'
    });
  }
});

module.exports = router;

