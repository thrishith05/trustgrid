const express = require('express');
const router = express.Router();
const duplicateDetection = require('../services/duplicateDetection');

/**
 * POST /api/duplicates/check
 * Check for duplicate reports
 */
router.post('/check', async (req, res) => {
  try {
    const { perceptual_hash, latitude, longitude, radius } = req.body;

    if (!perceptual_hash || !latitude || !longitude) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
        required: ['perceptual_hash', 'latitude', 'longitude']
      });
    }

    const result = await duplicateDetection.findDuplicates(
      perceptual_hash,
      parseFloat(latitude),
      parseFloat(longitude),
      radius ? parseFloat(radius) : null
    );

    res.json({
      success: true,
      is_duplicate: result.isDuplicate,
      duplicates: result.duplicates,
      count: result.count
    });

  } catch (error) {
    console.error('Error checking for duplicates:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check for duplicates'
    });
  }
});

/**
 * GET /api/duplicates/clusters
 * Get all duplicate clusters
 */
router.get('/clusters', async (req, res) => {
  try {
    const clusters = await duplicateDetection.getDuplicateClusters();

    res.json({
      success: true,
      count: clusters.length,
      clusters
    });

  } catch (error) {
    console.error('Error fetching duplicate clusters:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch duplicate clusters'
    });
  }
});

module.exports = router;

