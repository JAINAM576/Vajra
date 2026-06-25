const mongoose = require('mongoose');

const creditTransactionSchema = new mongoose.Schema(
  {
    shopkeeperId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Shopkeeper',
      required: [true, 'Shopkeeper ID is required'],
    },

    type: {
      type: String,
      enum: ['purchase', 'deduction', 'refund', 'bonus'],
      required: [true, 'Transaction type is required'],
    },
    amount: {
      type: Number,
      required: [true, 'Amount is required'],
      // positive = credit added, negative = credit deducted
    },

    // Purchase-specific fields
    pricePerCredit: {
      type: Number, // ₹ per credit at time of purchase (currently ₹1)
    },
    totalPrice: {
      type: Number, // total ₹ paid
    },
    paymentMethod: {
      type: String, // "UPI", "cash", "bank_transfer"
    },
    paymentReference: {
      type: String, // UPI transaction ID, receipt number, etc.
    },

    // Deduction-specific fields
    activationKeyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ActivationKey',
    },
    deviceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Device',
    },

    // Approval
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
    },

    // Balance Snapshot (for audit trail)
    balanceBefore: {
      type: Number,
    },
    balanceAfter: {
      type: Number,
    },

    notes: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
creditTransactionSchema.index({ shopkeeperId: 1, createdAt: -1 });
creditTransactionSchema.index({ type: 1 });
creditTransactionSchema.index({ createdAt: -1 });

module.exports = mongoose.model('CreditTransaction', creditTransactionSchema);
