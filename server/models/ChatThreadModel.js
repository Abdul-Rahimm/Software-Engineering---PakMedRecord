const mongoose = require('mongoose');

// One AI-assistant conversation. `messages` holds the exact message params of the
// provider that created it (Mistral or Claude), so history is replayed append-only.
// A thread can only be continued with the same provider.
const chatThreadSchema = new mongoose.Schema({
  role: { type: String, enum: ['doctor', 'patient'], required: true },
  cnic: { type: Number, required: true },
  title: { type: String, default: 'New conversation' },
  provider: { type: String, enum: ['mistral', 'anthropic'], default: 'anthropic' },
  messages: { type: [mongoose.Schema.Types.Mixed], default: [] },
}, { timestamps: true, minimize: false });

chatThreadSchema.index({ role: 1, cnic: 1, updatedAt: -1 });

module.exports = mongoose.model('ChatThread', chatThreadSchema);
