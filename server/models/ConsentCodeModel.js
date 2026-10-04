const mongoose = require('mongoose');

// One-time code a patient reads out so a hospital front desk can book for them.
// Stops any hospital from creating appointments for CNICs that never agreed to it.
const consentCodeSchema = new mongoose.Schema({
  orgId: { type: mongoose.Schema.Types.ObjectId, required: true },
  patientCNIC: { type: Number, required: true },
  codeHash: { type: String, required: true },
  attempts: { type: Number, default: 0 },
  usedAt: Date,
  expiresAt: { type: Date, required: true },
}, { timestamps: true });

consentCodeSchema.index({ orgId: 1, patientCNIC: 1, createdAt: -1 });
consentCodeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 3600 });

module.exports = mongoose.model('ConsentCode', consentCodeSchema);
