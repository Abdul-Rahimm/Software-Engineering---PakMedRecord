const mongoose = require('mongoose');

// Account fields shared by doctors, patients, admins and clinic staff

const accountFields = {
  disabled: { type: Boolean, default: false },
  disabledReason: { type: String, trim: true, maxlength: 300 },
  // tokens issued before this moment are rejected (set on password reset)
  passwordChangedAt: { type: Date },
  passwordResetTokenHash: { type: String, select: false },
  passwordResetExpires: { type: Date, select: false },
  // Two-step sign-in with an authenticator app (TOTP)
  twoFactor: {
    enabled: { type: Boolean, default: false },
    secret: { type: String, select: false },
    pendingSecret: { type: String, select: false },
    recoveryHashes: { type: [String], select: false },
  },
  // CNIC photo + live face check (see IdentityCheck); 'verified' only after an admin review
  identity: {
    status: { type: String, enum: ['none', 'pending', 'verified', 'rejected'], default: 'none' },
    checkId: { type: mongoose.Schema.Types.ObjectId },
    verifiedAt: Date,
    note: String,
  },
  // Terms & privacy acceptance at sign-up
  consentAt: { type: Date },
  termsVersion: { type: String },
};

module.exports = { accountFields };
