const mongoose = require('mongoose');

// A lab or pharmacy integrated through the partner API (authenticated by an API key)
const partnerSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 80 },
  type: { type: String, enum: ['lab', 'pharmacy'], required: true },
  keyPrefix: { type: String, required: true },
  keyHash: { type: String, required: true, unique: true },
  active: { type: Boolean, default: true },
  lastUsedAt: Date,
}, { timestamps: true });

partnerSchema.set('toJSON', { transform: (doc, ret) => { delete ret.keyHash; return ret; } });

module.exports = mongoose.model('Partner', partnerSchema);
