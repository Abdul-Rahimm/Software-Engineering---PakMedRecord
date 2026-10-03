const mongoose = require('mongoose');

// A merchant account that receives consultation fees directly (option B: money goes to the
// clinic or solo doctor, never through PakMedRecord). Secrets are stored encrypted.
const paymentAccountSchema = new mongoose.Schema({
  ownerType: { type: String, enum: ['doctor', 'clinic'], required: true },
  ownerId: { type: String, required: true }, // doctorCNIC or clinic _id
  provider: { type: String, enum: ['safepay'], default: 'safepay' },
  environment: { type: String, enum: ['sandbox', 'production'], default: 'sandbox' },
  publicKey: { type: String, required: true, trim: true },
  secretKeyEnc: { type: String, required: true },
  webhookSecretEnc: { type: String },
  enabled: { type: Boolean, default: true },
  verifiedAt: Date,
  lastError: String,
  updatedBy: Number,
}, { timestamps: true });

paymentAccountSchema.index({ ownerType: 1, ownerId: 1 }, { unique: true });

// never send secrets to the browser
paymentAccountSchema.set('toJSON', { transform: (doc, ret) => { delete ret.secretKeyEnc; delete ret.webhookSecretEnc; return ret; } });

module.exports = mongoose.model('PaymentAccount', paymentAccountSchema);
