const express = require('express');
const router = express.Router();
const database = require('../config/database');

/**
 * GET /api/civic-coins/:userId
 * Get civic coins balance for a user
 */
router.get('/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    const coinsData = await database.get('SELECT * FROM civic_coins WHERE user_id = ?', [userId]);

    const transactions = await database.query(
      'SELECT * FROM coin_transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT 10',
      [userId]
    );

    res.json({
      success: true,
      data: {
        coins: coinsData || { current_balance: 0, total_earned: 0 },
        recent_transactions: transactions || []
      }
    });

  } catch (error) {
    console.error('Error fetching civic coins:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch civic coins' });
  }
});

module.exports = router;
