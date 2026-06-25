const mongoose = require('mongoose');

const announcementSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Announcement title is required'],
      trim: true,
    },
    body: {
      type: String,
      required: [true, 'Announcement body is required'],
      trim: true,
    },

    type: {
      type: String,
      enum: ['DEAL', 'UPDATE', 'SYSTEM', 'TIPS'],
      default: 'UPDATE',
    },

    // Targeting
    targetType: {
      type: String,
      enum: ['all', 'specific'],
      default: 'all',
    },
    targetShopkeeperIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Shopkeeper',
      },
    ],

    // Display Metadata
    icon: {
      type: String,
    },
    color: {
      type: String, // hex color code
    },
    bgColor: {
      type: String, // hex background color
    },

    // Admin who sent it
    sentBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
    },

    // Read tracking
    readBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Shopkeeper',
      },
    ],
  },
  {
    timestamps: true,
  }
);

// Indexes
announcementSchema.index({ createdAt: -1 });
announcementSchema.index({ targetType: 1 });
announcementSchema.index({ targetShopkeeperIds: 1 });

module.exports = mongoose.model('Announcement', announcementSchema);
