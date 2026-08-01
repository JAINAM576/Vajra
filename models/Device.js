const mongoose = require('mongoose');

const deviceSchema = new mongoose.Schema(
  {
    deviceId: {
      type: String,
      required: [true, 'Device ID is required'],
      unique: true,
      trim: true,
    },
    shopkeeperId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Shopkeeper',
      required: [true, 'Shopkeeper ID is required'],
      index: true,
    },
    activationKeyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ActivationKey',
      unique: true,
    },
    activationKey: {
      type: String,
      trim: true,
    },

    // Customer Info
    customerName: {
      type: String,
      required: [true, 'Customer name is required'],
      trim: true,
    },
    customerMobile: {
      type: String,
      trim: true,
    },

    // Device Hardware
    platform: {
      type: String,
      enum: ['android', 'ios', 'other'],
      default: 'android',
    },
    deviceModel: {
      type: String,
      trim: true,
    },
    osVersion: {
      type: String,
    },
    imei: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
    },
    fcmToken: {
      type: String,
    },
    appVersion: {
      type: String,
    },
    isDeviceOwner: {
      type: Boolean,
      default: false,
    },

    // Device State (updated by heartbeat)
    isLocked: {
      type: Boolean,
      default: false,
    },
    batteryLevel: {
      type: Number,
      min: 0,
      max: 100,
    },
    isCharging: {
      type: Boolean,
      default: false,
    },
    isOnline: {
      type: Boolean,
      default: false,
    },
    lastSeen: {
      type: Date,
    },
    networkType: {
      type: String,
      default: 'unknown',
    },
    location: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point',
      },
      coordinates: {
        type: [Number], // [longitude, latitude] — GeoJSON format
        default: [0, 0],
      },
    },
    storageAvailable: {
      type: Number, // bytes
    },
    ramAvailable: {
      type: Number, // bytes
    },

    // Applied Tags (current active command states on device)
    appliedTags: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
      default: new Map(),
    },

    // EMI / Finance
    purchaseDate: {
      type: Date,
    },
    totalAmount: {
      type: Number,
      default: 0,
    },
    emiAmount: {
      type: Number,
      default: 0,
    },
    emiRemaining: {
      type: Number,
      default: 0,
    },
    totalEmis: {
      type: Number,
      default: 12,
    },
    paidEmis: {
      type: Number,
      default: 0,
    },
    interestRate: {
      type: Number,
      default: 0,
    },

    // Status
    isCompleted: {
      type: Boolean,
      default: false,
    },
    status: {
      type: String,
      default: 'Active',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
    registeredAt: {
      type: Date,
    },
    deactivatedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for common queries
deviceSchema.index({ isActive: 1, shopkeeperId: 1 });
deviceSchema.index({ isOnline: 1 });
deviceSchema.index({ location: '2dsphere' });

module.exports = mongoose.model('Device', deviceSchema);
