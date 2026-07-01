/**
 * Vajra Lock App — Auth Routes
 * POST /admin/login
 * POST /shopkeeper/register
 * POST /shopkeeper/login
 */

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const sendEmail = require('../utils/email');

const Admin = require('../models/Admin');
const Shopkeeper = require('../models/Shopkeeper');

/**
 * Sign a JWT with consistent options.
 */
const signToken = (payload) => {
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
};

// ─── POST /admin/login ───────────────────────────────────────────────
router.post('/admin/login', async (req, res) => {
  try {
    const { adminId, password } = req.body;
    console.log(`[DEBUG LOGIN] Attempting login. Received adminId: "${adminId}"`);

    // Validation
    if (!adminId || !password) {
      console.log('[DEBUG LOGIN] Validation failed: Missing adminId or password');
      return res.status(400).json({
        success: false,
        message: 'Admin ID and password are required.',
        data: {},
      });
    }

    // Find admin
    const admin = await Admin.findOne({ adminId: adminId.toLowerCase() });
    if (!admin) {
      console.log(`[DEBUG LOGIN] Admin not found for adminId (lowercase): "${adminId.toLowerCase()}"`);
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials.',
        data: {},
      });
    }

    console.log(`[DEBUG LOGIN] Admin found. DB adminId: "${admin.adminId}", isActive: ${admin.isActive}, stored password hash: "${admin.password}"`);

    if (!admin.isActive) {
      console.log('[DEBUG LOGIN] Admin account is deactivated.');
      return res.status(403).json({
        success: false,
        message: 'Account is deactivated. Contact super admin.',
        data: {},
      });
    }

    // Compare password
    const isMatch = await admin.comparePassword(password);
    console.log(`[DEBUG LOGIN] Bcrypt compare result: ${isMatch}`);
    if (!isMatch) {
      console.log('[DEBUG LOGIN] Password does not match hash');
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials.',
        data: {},
      });
    }

    // Update last login
    admin.lastLoginAt = new Date();
    await admin.save();

    // Generate token
    const token = signToken({ id: admin._id, role: admin.role });

    return res.status(200).json({
      success: true,
      message: 'Admin login successful.',
      data: {
        token,
        admin: admin.toJSON(),
      },
    });
  } catch (error) {
    console.error('Admin login error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Server error during login.',
      data: {},
    });
  }
});

// ─── POST /shopkeeper/register ───────────────────────────────────────
router.post('/shopkeeper/register', async (req, res) => {
  try {
    const {
      shopkeeperName,
      shopName,
      location,
      mobileNo,
      password,
      aadhaarNo,
      gmail,
    } = req.body;

    // Validation
    if (!shopkeeperName || !shopName || !location || !mobileNo || !password) {
      return res.status(400).json({
        success: false,
        message:
          'shopkeeperName, shopName, location, mobileNo, and password are required.',
        data: {},
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters.',
        data: {},
      });
    }

    if (!/^\d{10}$/.test(mobileNo)) {
      return res.status(400).json({
        success: false,
        message: 'Mobile number must be exactly 10 digits.',
        data: {},
      });
    }

    // Check duplicate mobile
    const existing = await Shopkeeper.findOne({ mobileNo, isDeleted: { $ne: true } });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'Mobile number is already registered.',
        data: {},
      });
    }

    // Create default assets
    const defaultWallpaper = 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1080';
    const profilePic = `https://ui-avatars.com/api/?name=${encodeURIComponent(shopkeeperName)}&background=4B5ABC&color=fff&size=200&bold=true`;

    // Create shopkeeper (plain password — the Mongoose pre-save hook hashes it)
    const createData = {
      shopkeeperName,
      shopName,
      location,
      mobileNo,
      password,
      profilePicUrl: profilePic,
      wallpaperUrl: defaultWallpaper,
    };
    if (aadhaarNo && aadhaarNo.trim()) {
      createData.aadhaarNo = aadhaarNo.trim();
    }
    if (gmail && gmail.trim()) {
      createData.gmail = gmail.trim().toLowerCase();
    }

    const shopkeeper = await Shopkeeper.create(createData);

    // Generate personalised wallpaper asynchronously — don't block registration on failure
    try {
      const { generateAndUploadWallpaper } = require('../utils/wallpaper');
      const wallpaperUrl = await generateAndUploadWallpaper(
        shopName,
        mobileNo,
        shopkeeper._id.toString()
      );
      if (wallpaperUrl) {
        shopkeeper.wallpaperUrl = wallpaperUrl;
        await shopkeeper.save();
        console.log(`[Register] Personalised wallpaper saved for ${shopName}`);
      }
    } catch (wpErr) {
      console.error('[Register] Wallpaper generation failed (using default):', wpErr.message);
      // Registration continues with the default wallpaper
    }

    // Generate token
    const token = signToken({ id: shopkeeper._id, role: 'shopkeeper' });

    // Remove password from response
    const shopkeeperObj = shopkeeper.toJSON();

    return res.status(201).json({
      success: true,
      message: 'Shopkeeper registered successfully.',
      data: {
        token,
        shopkeeper: shopkeeperObj,
      },
    });
  } catch (error) {
    console.error('Shopkeeper register error:', error.message);

    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Duplicate field value. Mobile number or Aadhaar already exists.',
        data: {},
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Server error during registration.',
      data: {},
    });
  }
});

// ─── POST /shopkeeper/login ──────────────────────────────────────────
router.post('/shopkeeper/login', async (req, res) => {
  try {
    const { mobileNo, password } = req.body;

    // Validation
    if (!mobileNo || !password) {
      return res.status(400).json({
        success: false,
        message: 'Mobile number and password are required.',
        data: {},
      });
    }

    // Find shopkeeper (not soft-deleted)
    const shopkeeper = await Shopkeeper.findOne({
      mobileNo,
      isDeleted: { $ne: true },
    });

    if (!shopkeeper) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials.',
        data: {},
      });
    }

    if (!shopkeeper.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Account is deactivated. Contact admin.',
        data: {},
      });
    }

    // Compare password
    const isMatch = await bcrypt.compare(password, shopkeeper.password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials.',
        data: {},
      });
    }

    // Update last used
    shopkeeper.lastUsed = new Date();
    await shopkeeper.save();

    // Generate token
    const token = signToken({ id: shopkeeper._id, role: 'shopkeeper' });

    // Remove password from response
    const shopkeeperObj = shopkeeper.toJSON();

    return res.status(200).json({
      success: true,
      message: 'Shopkeeper login successful.',
      data: {
        token,
        shopkeeper: shopkeeperObj,
      },
    });
  } catch (error) {
    console.error('Shopkeeper login error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Server error during login.',
      data: {},
    });
  }
});

// ─── POST /shopkeeper/forgot-password ────────────────────────────────
router.post('/shopkeeper/forgot-password', async (req, res) => {
  try {
    const { gmail } = req.body;

    if (!gmail) {
      return res.status(400).json({
        success: false,
        message: 'Email address is required.',
        data: {},
      });
    }

    const shopkeeper = await Shopkeeper.findOne({
      gmail: gmail.toLowerCase(),
      isDeleted: { $ne: true },
    });

    if (!shopkeeper) {
      return res.status(404).json({
        success: false,
        message: 'No shopkeeper account registered with this email address.',
        data: {},
      });
    }

    // Rate limit: 1 minute between OTP requests
    if (shopkeeper.resetPasswordOtpSentAt && Date.now() - shopkeeper.resetPasswordOtpSentAt < 60 * 1000) {
      return res.status(429).json({
        success: false,
        message: 'Please wait 1 minute before requesting another OTP.',
        data: {},
      });
    }

    // 1. Generate 6-digit numeric OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // 2. Hash and store OTP in database (valid for 10 minutes)
    const hashedOtp = crypto.createHash('sha256').update(otp).digest('hex');
    shopkeeper.resetPasswordOtp = hashedOtp;
    shopkeeper.resetPasswordOtpExpires = Date.now() + 10 * 60 * 1000;
    shopkeeper.resetPasswordOtpSentAt = Date.now();
    await shopkeeper.save();

    // 3. Send email via sendEmail utility
    const message = `Your password reset verification code is: ${otp}\nThis code is valid for 10 minutes. Please do not share it with anyone.`;
    const html = `
      <div style="font-family: sans-serif; padding: 20px; line-height: 1.6; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px;">
        <h2 style="color: #2563EB; border-bottom: 2px solid #2563EB; padding-bottom: 10px;">Password Reset Verification</h2>
        <p>You requested a code to reset the password for your Vajra LockApp shopkeeper account.</p>
        <p>Your one-time verification code is:</p>
        <div style="background-color: #f3f4f6; padding: 15px; text-align: center; border-radius: 6px; margin: 20px 0;">
          <h1 style="color: #1f2937; letter-spacing: 6px; margin: 0; font-size: 36px; font-family: monospace;">${otp}</h1>
        </div>
        <p style="color: #6b7280; font-size: 14px;">This code is valid for 10 minutes. If you did not request this, you can safely ignore this email.</p>
      </div>
    `;

    await sendEmail({
      email: shopkeeper.gmail,
      subject: 'Vajra LockApp — Password Reset Verification Code',
      message,
      html,
    });

    return res.status(200).json({
      success: true,
      message: 'Verification code sent to your registered email address.',
      data: {},
    });
  } catch (error) {
    console.error('Shopkeeper forgot password error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to send OTP verification email. Please check configuration.',
      data: {},
    });
  }
});

// ─── POST /shopkeeper/reset-password ─────────────────────────────────
router.post('/shopkeeper/reset-password', async (req, res) => {
  try {
    const { gmail, otp, newPassword } = req.body;

    if (!gmail || !otp || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Email, verification code, and new password are required.',
        data: {},
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long.',
        data: {},
      });
    }

    const shopkeeper = await Shopkeeper.findOne({
      gmail: gmail.toLowerCase(),
      isDeleted: { $ne: true },
    });

    if (!shopkeeper) {
      return res.status(404).json({
        success: false,
        message: 'Shopkeeper account not found.',
        data: {},
      });
    }

    // Verify OTP hash & expiry
    const hashedOtp = crypto.createHash('sha256').update(otp.trim()).digest('hex');

    if (
      shopkeeper.resetPasswordOtp !== hashedOtp ||
      !shopkeeper.resetPasswordOtpExpires ||
      shopkeeper.resetPasswordOtpExpires < Date.now()
    ) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired verification code.',
        data: {},
      });
    }

    // Hash the password via pre-save hook and save
    shopkeeper.password = newPassword;
    shopkeeper.resetPasswordOtp = null;
    shopkeeper.resetPasswordOtpExpires = null;
    await shopkeeper.save();

    return res.status(200).json({
      success: true,
      message: 'Password updated successfully. You can now log in.',
      data: {},
    });
  } catch (error) {
    console.error('Shopkeeper reset password error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Server error resetting password.',
      data: {},
    });
  }
});

module.exports = router;
