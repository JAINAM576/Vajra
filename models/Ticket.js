const mongoose = require('mongoose');

const ticketSchema = new mongoose.Schema(
  {
    ticketId: {
      type: String,
      unique: true,
      required: [true, 'Ticket ID is required'],
    },
    shopkeeperId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Shopkeeper',
      required: [true, 'Shopkeeper ID is required'],
    },
    shopkeeperName: {
      type: String, // denormalized for display performance
    },
    deviceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Device',
    },
    customerName: {
      type: String, // denormalized from device
    },
    commandLogId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CommandLog',
    },

    // Command Info (denormalized for quick display)
    commandAttempted: {
      type: String, // FCM command e.g. "LOCK_DEVICE"
    },
    commandLabel: {
      type: String, // e.g. "Lock Device"
    },
    errorReason: {
      type: String,
    },
    smsPayload: {
      type: String,
    },

    // Status
    status: {
      type: String,
      enum: ['open', 'in_progress', 'resolved', 'rejected'],
      default: 'open',
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      default: 'medium',
    },

    // Resolution
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
    },
    resolution: {
      type: String,
    },
    resolvedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
ticketSchema.index({ status: 1, priority: -1 });
ticketSchema.index({ shopkeeperId: 1 });
ticketSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Ticket', ticketSchema);
