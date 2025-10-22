const express = require('express');
const router = express.Router();
const database = require('../config/database');

/**
 * GET /api/vouchers
 * Get available vouchers for redemption
 */
router.get('/', async (req, res) => {
  try {
    const vouchers = await database.query(
      'SELECT * FROM vouchers WHERE active = 1 ORDER BY coin_cost ASC'
    );

    res.json({
      success: true,
      data: { vouchers: vouchers || [] }
    });

  } catch (error) {
    console.error('Error fetching vouchers:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch vouchers' });
  }
});

/**
 * POST /api/vouchers/:voucherId/redeem
 * Redeem a voucher using civic coins
 */
router.post('/:voucherId/redeem', async (req, res) => {
  try {
    const { voucherId } = req.params;
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ success: false, error: 'User ID is required' });
    }

    // Get voucher details
    const voucher = await database.get(
      'SELECT * FROM vouchers WHERE id = ? AND active = 1',
      [voucherId]
    );

    if (!voucher) {
      return res.status(404).json({ success: false, error: 'Voucher not found or inactive' });
    }

    // Check user's coin balance
    const userCoins = await database.get(
      'SELECT current_balance FROM civic_coins WHERE user_id = ?',
      [userId]
    );

    const currentBalance = userCoins?.current_balance || 0;

    if (currentBalance < voucher.coin_cost) {
      return res.status(400).json({ 
        success: false, 
        error: 'Insufficient civic coins',
        required: voucher.coin_cost,
        available: currentBalance
      });
    }

    // Check if user already redeemed this voucher
    const existingRedemption = await database.get(
      'SELECT * FROM voucher_redemptions WHERE user_id = ? AND voucher_id = ?',
      [userId, voucherId]
    );

    if (existingRedemption) {
      return res.status(400).json({ 
        success: false, 
        error: 'Voucher already redeemed by this user' 
      });
    }

    // Deduct coins and record redemption
    await database.run(
      `UPDATE civic_coins 
       SET current_balance = current_balance - ?, last_updated = CURRENT_TIMESTAMP
       WHERE user_id = ?`,
      [voucher.coin_cost, userId]
    );

    await database.run(
      `INSERT INTO voucher_redemptions (
         user_id, voucher_id, redemption_code, redeemed_at
       ) VALUES (?, ?, ?, CURRENT_TIMESTAMP)`,
      [userId, voucherId, `VC-${Date.now()}-${userId.slice(-4)}`]
    );

    // Log the transaction
    await database.run(
      `INSERT INTO coin_transactions (
         user_id, voucher_id, transaction_type, amount, description, created_at
       ) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      [userId, voucherId, 'spent', voucher.coin_cost, `Redeemed voucher: ${voucher.title}`]
    );

    console.log(`✅ User ${userId} redeemed voucher ${voucherId} for ${voucher.coin_cost} coins`);

    res.json({
      success: true,
      message: 'Voucher redeemed successfully',
      data: {
        voucher: voucher,
        new_balance: currentBalance - voucher.coin_cost,
        redemption_code: `VC-${Date.now()}-${userId.slice(-4)}`
      }
    });

  } catch (error) {
    console.error('Error redeeming voucher:', error);
    res.status(500).json({ success: false, error: 'Failed to redeem voucher' });
  }
});

module.exports = router;
