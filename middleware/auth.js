/**
 * Vajra Lock App — Authentication & Authorization Middleware
 */

const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');
const Shopkeeper = require('../models/Shopkeeper');

/**
 * authenticate — Verify JWT from Authorization header and attach user to req.
 */
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.',
        data: {},
      });
    }

    const token = authHeader.split(' ')[1];

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      const message =
        err.name === 'TokenExpiredError'
          ? 'Token has expired. Please login again.'
          : 'Invalid token. Please login again.';
      return res.status(401).json({ success: false, message, data: {} });
    }

    let user = null;

    if (decoded.role === 'super_admin' || decoded.role === 'support_admin') {
      user = await Admin.findById(decoded.id).select('-password');
      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Admin account not found.',
          data: {},
        });
      }
      if (!user.isActive) {
        return res.status(403).json({
          success: false,
          message: 'Admin account is deactivated.',
          data: {},
        });
      }
    } else if (decoded.role === 'shopkeeper') {
      user = await Shopkeeper.findById(decoded.id).select('-password');
      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Shopkeeper account not found.',
          data: {},
        });
      }
      if (user.isDeleted) {
        return res.status(401).json({
          success: false,
          message: 'Account has been deleted.',
          data: {},
        });
      }
      if (!user.isActive) {
        return res.status(403).json({
          success: false,
          message: 'Account is deactivated. Contact admin.',
          data: {},
        });
      }
    } else {
      return res.status(401).json({
        success: false,
        message: 'Invalid token role.',
        data: {},
      });
    }

    req.user = {
      id: user._id,
      role: decoded.role,
      doc: user, // full document for convenience
    };

    next();
  } catch (error) {
    console.error('Auth middleware error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Authentication error.',
      data: {},
    });
  }
};

/**
 * authorizeAdmin — Allow only super_admin or support_admin roles.
 */
const authorizeAdmin = (req, res, next) => {
  if (req.user.role === 'super_admin' || req.user.role === 'support_admin') {
    return next();
  }
  return res.status(403).json({
    success: false,
    message: 'Access denied. Admin privileges required.',
    data: {},
  });
};

/**
 * authorizeShopkeeper — Allow only shopkeeper role.
 */
const authorizeShopkeeper = (req, res, next) => {
  if (req.user.role === 'shopkeeper') {
    return next();
  }
  return res.status(403).json({
    success: false,
    message: 'Access denied. Shopkeeper privileges required.',
    data: {},
  });
};

module.exports = { authenticate, authorizeAdmin, authorizeShopkeeper };
