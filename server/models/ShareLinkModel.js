const mongoose = require('mongoose');

// Time-limited, read-only link a patient gives to any doctor (no account needed)
const shareLinkSchema = new mongoose.Schema({
  tokenHash: { type: String, required: true, unique: true },
  patientCNIC: { type: Number, required: true, index: true },
  label: { type: String, trim: true, maxlength: 80 },
  includeProfile: { type: Boolean, default: true },
  includeVitals: { type: Boolean, default: true },
  // empty = all records
  recordIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'MedicalRecord' }],
  expiresAt: { type: Date, required: true },
  revokedAt: Date,
  views: { type: Number, default: 0 },
  lastViewedAt: Date,
}, { timestamps: true });

module.exports = mongoose.model('ShareLink', shareLinkSchema);
