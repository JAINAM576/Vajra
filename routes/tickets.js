/**
 * Vajra Lock App — Ticket / Support Routes
 * GET  /                 — List tickets (role-scoped)
 * GET  /:ticketId        — Get single ticket
 * POST /                 — Create ticket
 * PUT  /:ticketId/resolve — Resolve ticket (admin)
 * PUT  /:ticketId/reject  — Reject ticket (admin)
 */

const express = require('express');
const router = express.Router();

const Ticket = require('../models/Ticket');
const { authenticate, authorizeAdmin } = require('../middleware/auth');
const { generateTicketId } = require('../utils/helpers');

// All routes require authentication
router.use(authenticate);

// ─── GET / — List tickets (role-scoped) ──────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { status } = req.query;

    const filter = {};

    // Scope to shopkeeper's own tickets
    if (req.user.role === 'shopkeeper') {
      filter.shopkeeperId = req.user.id;
    }

    // Status filter (comma-separated, e.g. ?status=open,resolved)
    if (status) {
      const statuses = status.split(',').map((s) => s.trim());
      filter.status = { $in: statuses };
    }

    const tickets = await Ticket.find(filter)
      .sort({ createdAt: -1 })
      .populate('resolvedBy', 'name adminId')
      .lean();

    return res.status(200).json({
      success: true,
      message: 'Tickets retrieved successfully.',
      data: { tickets, count: tickets.length },
    });
  } catch (error) {
    console.error('List tickets error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Server error fetching tickets.',
      data: {},
    });
  }
});

// ─── POST / — Create ticket ──────────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const {
      shopkeeperId,
      shopkeeperName,
      deviceId,
      customerName,
      commandLogId,
      commandAttempted,
      commandLabel,
      errorReason,
      priority,
    } = req.body;

    if (!commandAttempted || !errorReason) {
      return res.status(400).json({
        success: false,
        message: 'commandAttempted and errorReason are required.',
        data: {},
      });
    }

    // Auto-generate ticketId
    const lastTicket = await Ticket.findOne()
      .sort({ createdAt: -1 })
      .select('ticketId')
      .lean();

    let lastNumber = 0;
    if (lastTicket && lastTicket.ticketId) {
      const match = lastTicket.ticketId.match(/TKT-(\d+)/);
      if (match) lastNumber = parseInt(match[1], 10);
    }

    const ticketId = generateTicketId(lastNumber);

    const ticket = await Ticket.create({
      ticketId,
      shopkeeperId: shopkeeperId || req.user.id,
      shopkeeperName: shopkeeperName || '',
      deviceId: deviceId || '',
      customerName: customerName || '',
      commandLogId: commandLogId || null,
      commandAttempted,
      commandLabel: commandLabel || commandAttempted,
      errorReason,
      status: 'open',
      priority: priority || 'medium',
    });

    return res.status(201).json({
      success: true,
      message: 'Ticket created successfully.',
      data: { ticket },
    });
  } catch (error) {
    console.error('Create ticket error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Server error creating ticket.',
      data: {},
    });
  }
});

// ─── GET /:ticketId — Get single ticket ──────────────────────────────
router.get('/:ticketId', async (req, res) => {
  try {
    const filter = { ticketId: req.params.ticketId };

    // Shopkeepers can only see their own tickets
    if (req.user.role === 'shopkeeper') {
      filter.shopkeeperId = req.user.id;
    }

    const ticket = await Ticket.findOne(filter)
      .populate('resolvedBy', 'name adminId')
      .populate('commandLogId')
      .lean();

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'Ticket not found.',
        data: {},
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Ticket retrieved successfully.',
      data: { ticket },
    });
  } catch (error) {
    console.error('Get ticket error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Server error fetching ticket.',
      data: {},
    });
  }
});

// ─── PUT /:ticketId/resolve — Admin: resolve ticket ──────────────────
router.put('/:ticketId/resolve', authorizeAdmin, async (req, res) => {
  try {
    const { resolution } = req.body;

    if (!resolution) {
      return res.status(400).json({
        success: false,
        message: 'resolution is required.',
        data: {},
      });
    }

    const ticket = await Ticket.findOneAndUpdate(
      { ticketId: req.params.ticketId },
      {
        $set: {
          status: 'resolved',
          resolution,
          resolvedBy: req.user.id,
          resolvedAt: new Date(),
        },
      },
      { new: true }
    );

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'Ticket not found.',
        data: {},
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Ticket resolved successfully.',
      data: { ticket },
    });
  } catch (error) {
    console.error('Resolve ticket error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Server error resolving ticket.',
      data: {},
    });
  }
});

// ─── PUT /:ticketId/reject — Admin: reject ticket ────────────────────
router.put('/:ticketId/reject', authorizeAdmin, async (req, res) => {
  try {
    const { resolution } = req.body;

    if (!resolution) {
      return res.status(400).json({
        success: false,
        message: 'resolution is required.',
        data: {},
      });
    }

    const ticket = await Ticket.findOneAndUpdate(
      { ticketId: req.params.ticketId },
      {
        $set: {
          status: 'rejected',
          resolution,
          resolvedBy: req.user.id,
          resolvedAt: new Date(),
        },
      },
      { new: true }
    );

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'Ticket not found.',
        data: {},
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Ticket rejected.',
      data: { ticket },
    });
  } catch (error) {
    console.error('Reject ticket error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Server error rejecting ticket.',
      data: {},
    });
  }
});

module.exports = router;
