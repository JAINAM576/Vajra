const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const distributorSchema = new mongoose.Schema(
  {
    distributorId: {
      type: String,
      required: [true, 'Distributor ID is required'],
      unique: true,
      trim: true,
      uppercase: true,
      match: [/^[A-Z]{3}\d{3}$/, 'Distributor ID must be 3 letters followed by 3 numbers (e.g. DIS101)'],
    },
    name: {
      type: String,
      required: [true, 'Distributor name is required'],
      trim: true,
    },
    area: {
      type: String,
      trim: true,
      default: '',
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
    credits: {
      type: Number,
      default: 50,
    },
    androidCredits: {
      type: Number,
      default: 0,
    },
    iosCredits: {
      type: Number,
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    lastLoginAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Hash password before saving
distributorSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Compare password method
distributorSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Remove password from JSON output
distributorSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  obj.androidCredits = obj.androidCredits || 0;
  obj.iosCredits = obj.iosCredits || 0;
  obj.credits = obj.androidCredits + obj.iosCredits;
  return obj;
};

module.exports = mongoose.model('Distributor', distributorSchema);
