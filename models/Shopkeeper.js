const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const shopkeeperSchema = new mongoose.Schema(
  {
    shopkeeperName: {
      type: String,
      required: [true, 'Shopkeeper name is required'],
      trim: true,
    },
    shopName: {
      type: String,
      required: [true, 'Shop name is required'],
      trim: true,
    },
    location: {
      type: String,
      trim: true,
    },
    mobileNo: {
      type: String,
      required: [true, 'Mobile number is required'],
      unique: true,
      trim: true,
      match: [/^[6-9]\d{9}$/, 'Please enter a valid Indian mobile number'],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: 6,
    },
    aadhaarNo: {
      type: String,
      unique: true,
      sparse: true, // allows null values without triggering unique constraint
      trim: true,
      match: [/^\d{12}$/, 'Aadhaar number must be 12 digits'],
    },
    gmail: {
      type: String,
      trim: true,
      lowercase: true,
    },
    profilePicUrl: {
      type: String,
      default: '',
    },

    // Credit System
    credits: {
      type: Number,
      default: 0,
      min: [0, 'Credits cannot be negative'],
    },
    totalCreditsUsed: {
      type: Number,
      default: 0,
    },

    // Account State
    isActive: {
      type: Boolean,
      default: true,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
    lastUsed: {
      type: Date,
    },

    // Wallpaper URL (Cloudinary — set later)
    wallpaperUrl: {
      type: String,
      default: '',
    },
    smsSecretPin: {
      type: String,
      default: '0000',
    },
    resetPasswordOtp: {
      type: String,
      default: null,
    },
    resetPasswordOtpExpires: {
      type: Date,
      default: null,
    },

    // Notification Preferences (embedded sub-document)
    notificationSettings: {
      dashboardReminders: { type: Boolean, default: true },
      pushAlerts: { type: Boolean, default: true },
      whatsappAuto: { type: Boolean, default: false },
      smsAlerts: { type: Boolean, default: false },
    },
  },
  {
    timestamps: true,
  }
);

// Text index for admin search
shopkeeperSchema.index({ shopName: 'text', shopkeeperName: 'text' });

// Hash password before saving
shopkeeperSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Compare password method
shopkeeperSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Remove password from JSON output and map profilePicUrl to profilePic for the frontend
shopkeeperSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  obj.profilePic = obj.profilePicUrl || '';
  return obj;
};

module.exports = mongoose.model('Shopkeeper', shopkeeperSchema);
