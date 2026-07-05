const mongoose = require('mongoose');

const commandLogSchema = new mongoose.Schema(
  {
    deviceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Device',
      required: [true, 'Device ID is required'],
    },
    shopkeeperId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Shopkeeper',
      required: [true, 'Shopkeeper ID is required'],
    },

    // Command Details
    commandId: {
      type: String, // e.g. "lock", "unlock", "set_pin", "wallpaper"
    },
    commandType: {
      type: String, // FCM command string e.g. "LOCK_DEVICE", "SET_WALLPAPER"
    },
    commandLabel: {
      type: String, // human-readable e.g. "Lock Device"
    },
    category: {
      type: String,
      enum: ['lock', 'hardware', 'connectivity', 'app', 'actions', 'general'],
    },
    inputValue: {
      type: String, // if command had input (PIN, alert msg, wallpaper URL)
    },
    smsPayload: {
      type: String,
    },

    // Execution Mode
    mode: {
      type: String,
      enum: ['online', 'offline', 'sms_gateway'],
      default: 'online',
    },

    // Execution Status
    status: {
      type: String,
      enum: ['pending', 'sent', 'delivered', 'executed', 'failed', 'timeout'],
      default: 'pending',
    },
    errorReason: {
      type: String,
    },
    ticketId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Ticket',
    },

    // FCM Response
    fcmMessageId: {
      type: String,
    },

    // Timestamps for each status transition
    sentAt: {
      type: Date,
    },
    deliveredAt: {
      type: Date,
    },
    executedAt: {
      type: Date,
    },
    failedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for efficient queries
commandLogSchema.index({ deviceId: 1, createdAt: -1 });
commandLogSchema.index({ shopkeeperId: 1, createdAt: -1 });
commandLogSchema.index({ status: 1 });
commandLogSchema.index({ commandType: 1 });

// TTL Index: auto-delete documents after 180 days (6 months)
commandLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 180 * 24 * 60 * 60 });

module.exports = mongoose.model('CommandLog', commandLogSchema);
