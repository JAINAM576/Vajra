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

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create default assets
    const defaultWallpaper = 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1080';
    const profilePic = `https://ui-avatars.com/api/?name=${encodeURIComponent(shopkeeperName)}&background=4B5ABC&color=fff&size=200&bold=true`;

    // Create shopkeeper
    const shopkeeper = await Shopkeeper.create({
      shopkeeperName,
      shopName,
      location,
      mobileNo,
      password: hashedPassword,
      aadhaarNo: aadhaarNo || '',
      gmail: gmail || '',
      profilePicUrl: profilePic,
      wallpaperUrl: defaultWallpaper,
    });

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
    const { mobileNo, gmail } = req.body;

    if (!mobileNo && !gmail) {
      return res.status(400).json({
        success: false,
        message: 'Mobile number or Gmail is required.',
        data: {},
      });
    }

    const query = { isDeleted: { $ne: true } };
    if (mobileNo) {
      query.mobileNo = mobileNo;
    } else {
      query.gmail = gmail;
    }

    const shopkeeper = await Shopkeeper.findOne(query);
    if (!shopkeeper) {
      return res.status(404).json({
        success: false,
        message: 'Shopkeeper not found.',
        data: {},
      });
    }

    // Check rate limit: 1 minute
    if (shopkeeper.resetPasswordOtpSentAt && Date.now() - shopkeeper.resetPasswordOtpSentAt < 60 * 1000) {
      return res.status(429).json({
        success: false,
        message: 'Please wait 1 minute before requesting another OTP.',
        data: {},
      });
    }

    // Generate random 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Hash it using SHA256
    const hashedOtp = crypto.createHash('sha256').update(otp).digest('hex');

    shopkeeper.resetPasswordOtp = hashedOtp;
    shopkeeper.resetPasswordOtpExpires = Date.now() + 10 * 60 * 1000; // 10 mins
    shopkeeper.resetPasswordOtpSentAt = Date.now();
    await shopkeeper.save();

    // Send the email (mock or real if SMTP config is present)
    console.log(`[OTP DEBUG] Generated OTP for shopkeeper ${shopkeeper.shopkeeperName}: ${otp}`);
    
    if (shopkeeper.gmail) {
      // Mock / dynamic email sending
      if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
        try {
          const nodemailer = require('nodemailer');
          const transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: process.env.SMTP_PORT || 587,
            secure: process.env.SMTP_SECURE === 'true',
            auth: {
              user: process.env.SMTP_USER,
              pass: process.env.SMTP_PASS,
            },
          });
          
          await transporter.sendMail({
            from: process.env.SMTP_FROM || '"Vajra Support" <noreply@vajra.com>',
            to: shopkeeper.gmail,
            subject: 'Vajra Password Reset OTP',
            text: `Your OTP for resetting password is: ${otp}. Valid for 10 minutes.`,
            html: `<p>Your OTP for resetting password is: <strong>${otp}</strong>. Valid for 10 minutes.</p>`,
          });
          console.log(`[OTP EMAIL] Sent OTP successfully to ${shopkeeper.gmail}`);
        } catch (mailErr) {
          console.error('[OTP EMAIL] SMTP Mailer Error:', mailErr.message);
        }
      }
    }

    return res.status(200).json({
      success: true,
      message: 'OTP sent successfully to registered email if exists.',
      data: {},
    });
  } catch (error) {
    console.error('Shopkeeper forgot password error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Server error generating OTP.',
      data: {},
    });
  }
});

// ─── POST /shopkeeper/reset-password ─────────────────────────────────
router.post('/shopkeeper/reset-password', async (req, res) => {
  try {
    const { mobileNo, gmail, otp, newPassword } = req.body;

    if ((!mobileNo && !gmail) || !otp || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Identifier (mobileNo or gmail), OTP, and newPassword are required.',
        data: {},
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters.',
        data: {},
      });
    }

    const query = { isDeleted: { $ne: true } };
    if (mobileNo) {
      query.mobileNo = mobileNo;
    } else {
      query.gmail = gmail;
    }

    const shopkeeper = await Shopkeeper.findOne(query);
    if (!shopkeeper) {
      return res.status(404).json({
        success: false,
        message: 'Shopkeeper not found.',
        data: {},
      });
    }

    // Verify OTP exists and has not expired
    if (!shopkeeper.resetPasswordOtp || !shopkeeper.resetPasswordOtpExpires || shopkeeper.resetPasswordOtpExpires < Date.now()) {
      return res.status(400).json({
        success: false,
        message: 'OTP has expired or is invalid.',
        data: {},
      });
    }

    // Verify OTP match
    const hashedOtp = crypto.createHash('sha256').update(otp).digest('hex');
    if (shopkeeper.resetPasswordOtp !== hashedOtp) {
      return res.status(400).json({
        success: false,
        message: 'Invalid OTP.',
        data: {},
      });
    }

    // Update password (triggers hashing in pre-save hook) and clear OTP fields
    shopkeeper.password = newPassword;
    shopkeeper.resetPasswordOtp = undefined;
    shopkeeper.resetPasswordOtpExpires = undefined;
    await shopkeeper.save();

    return res.status(200).json({
      success: true,
      message: 'Password reset successful. You can now login.',
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
