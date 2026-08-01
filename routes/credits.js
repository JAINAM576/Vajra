/**
 * Vajra Lock App — Credit Routes
 * GET  /:shopkeeperId        — Credit transaction history
 * POST /:shopkeeperId/add    — Add credits (admin only)
 * GET  /summary/platform     — Platform-wide credit stats (admin only)
 */

const express = require('express');
const router = express.Router();

const CreditTransaction = require('../models/CreditTransaction');
const Shopkeeper = require('../models/Shopkeeper');
const { authenticate, authorizeAdmin } = require('../middleware/auth');

// All routes require authentication
router.use(authenticate);

// ─── GET /summary/platform — Admin: aggregate credit stats ───────────
// Must be defined BEFORE /:shopkeeperId to avoid param collision
router.get('/summary/platform', authorizeAdmin, async (req, res) => {
  try {
    const [purchaseStats, deductionStats] = await Promise.all([
      CreditTransaction.aggregate([
        { $match: { type: 'purchase' } },
        {
          $group: {
            _id: null,
            totalCreditsPurchased: { $sum: '$amount' },
            totalRevenue: { $sum: '$totalPrice' },
            transactionCount: { $sum: 1 },
          },
        },
      ]),
      CreditTransaction.aggregate([
        { $match: { type: 'deduction' } },
        {
          $group: {
            _id: null,
            totalCreditsUsed: { $sum: { $abs: '$amount' } },
            transactionCount: { $sum: 1 },
          },
        },
      ]),
    ]);

    const purchase = purchaseStats[0] || {
      totalCreditsPurchased: 0,
      totalRevenue: 0,
      transactionCount: 0,
    };
    const deduction = deductionStats[0] || {
      totalCreditsUsed: 0,
      transactionCount: 0,
    };

    return res.status(200).json({
      success: true,
      message: 'Platform credit summary retrieved successfully.',
      data: {
        totalCreditsPurchased: purchase.totalCreditsPurchased,
        totalCreditsUsed: deduction.totalCreditsUsed,
        totalRevenue: purchase.totalRevenue,
        purchaseTransactions: purchase.transactionCount,
        deductionTransactions: deduction.transactionCount,
      },
    });
  } catch (error) {
    console.error('Platform summary error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Server error fetching platform summary.',
      data: {},
    });
  }
});

// ─── GET /:shopkeeperId — Credit transaction history ─────────────────
router.get('/:shopkeeperId', async (req, res) => {
  try {
    const { shopkeeperId } = req.params;

    // Shopkeepers can only view their own history
    if (
      req.user.role === 'shopkeeper' &&
      req.user.id.toString() !== shopkeeperId
    ) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only view your own credit history.',
        data: {},
      });
    }

    const transactions = await CreditTransaction.find({ shopkeeperId })
      .sort({ createdAt: -1 })
      .populate('approvedBy', 'name adminId')
      .lean();

    return res.status(200).json({
      success: true,
      message: 'Credit transactions retrieved successfully.',
      data: { transactions, count: transactions.length },
    });
  } catch (error) {
    console.error('Credit history error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Server error fetching credit history.',
      data: {},
    });
  }
});

// ─── POST /:shopkeeperId/add — Admin: add/deduct credits ──────────────
router.post('/:shopkeeperId/add', authorizeAdmin, async (req, res) => {
  try {
    const { shopkeeperId } = req.params;
    const { amount, paymentMethod, paymentReference, notes } = req.body;

    if (typeof amount !== 'number' || amount === 0) {
      return res.status(400).json({
        success: false,
        message: 'A non-zero numeric amount is required.',
        data: {},
      });
    }

    const shopkeeper = await Shopkeeper.findById(shopkeeperId);
    if (!shopkeeper || shopkeeper.isDeleted) {
      return res.status(404).json({
        success: false,
        message: 'Shopkeeper not found.',
        data: {},
      });
    }

    const balanceBefore = shopkeeper.credits || 0;
    const balanceAfter = balanceBefore + amount;

    shopkeeper.credits = balanceAfter;
    await shopkeeper.save();

    const transactionType = amount < 0 ? 'deduction' : 'purchase';

    const transaction = await CreditTransaction.create({
      shopkeeperId,
      type: transactionType,
      amount,
      pricePerCredit: amount < 0 ? 0 : 1,
      totalPrice: amount < 0 ? 0 : amount,
      balanceBefore,
      balanceAfter,
      paymentMethod: paymentMethod || 'manual',
      paymentReference: paymentReference || '',
      notes: notes || '',
      approvedBy: req.user.id,
    });

    return res.status(201).json({
      success: true,
      message: `${amount < 0 ? Math.abs(amount) + ' credits deducted from' : amount + ' credits added to'} shopkeeper.`,
      data: {
        credits: balanceAfter,
        transaction,
      },
    });
  } catch (error) {
    console.error('Add credits error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Server error adding credits.',
      data: {},
    });
  }
});

module.exports = router;
