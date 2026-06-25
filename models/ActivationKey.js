const mongoose = require('mongoose');

const activationKeySchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: [true, 'Activation key is required'],
      unique: true,
      uppercase: true,
      trim: true,
    },
    shopkeeperId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Shopkeeper',
      required: [true, 'Shopkeeper ID is required'],
      index: true,
    },

    // Binding State
    isUsed: {
      type: Boolean,
      default: false,
    },
    deviceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Device',
    },
    customerName: {
      type: String,
      trim: true,
    },
    deviceModel: {
      type: String,
      trim: true,
    },

    status: {
      type: String,
      enum: ['pending', 'activated', 'revoked', 'expired'],
      default: 'pending',
    },
    activatedAt: {
      type: Date,
    },
    revokedAt: {
      type: Date,
    },
    expiresAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes
activationKeySchema.index({ status: 1 });
activationKeySchema.index({ isUsed: 1, shopkeeperId: 1 });

module.exports = mongoose.model('ActivationKey', activationKeySchema);
