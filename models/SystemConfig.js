const mongoose = require('mongoose');

const wallpaperTemplateSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true },
    url: { type: String, required: true }, // Cloudinary URL
    addedAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const systemConfigSchema = new mongoose.Schema(
  {
    configKey: {
      type: String,
      unique: true,
      required: true,
      default: 'platform',
    },

    // Credit Pricing
    creditPriceINR: {
      type: Number,
      default: 1, // ₹1 = 1 credit
    },

    // Payment QR (Cloudinary URL — uploaded later)
    paymentQrUrl: {
      type: String,
      default: '',
    },
    upiId: {
      type: String,
      default: '',
    },

    // Wallpaper Templates (Cloudinary URLs — uploaded later)
    wallpaperTemplates: [wallpaperTemplateSchema],

    // Platform Controls
    maintenanceMode: {
      type: Boolean,
      default: false,
    },
    minAppVersion: {
      type: String,
      default: '1.0.0',
    },

    // Last updated by
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('SystemConfig', systemConfigSchema);
