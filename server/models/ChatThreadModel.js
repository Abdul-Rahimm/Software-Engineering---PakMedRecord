const mongoose = require('mongoose');

// One AI-assistant conversation. `messages` holds the exact Claude API message
// params (including thinking and tool blocks) so history is replayed append-only.
const chatThreadSchema = new mongoose.Schema({
  role: { type: String, enum: ['doctor', 'patient'], required: true },
  cnic: { type: Number, required: true },
  title: { type: String, default: 'New conversation' },
  messages: { type: [mongoose.Schema.Types.Mixed], default: [] },
}, { timestamps: true, minimize: false });

chatThreadSchema.index({ role: 1, cnic: 1, updatedAt: -1 });

module.exports = mongoose.model('ChatThread', chatThreadSchema);
