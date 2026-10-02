const mongoose = require('mongoose');

// A user reporting an account (e.g. a suspicious doctor) to the platform admins
const reportSchema = new mongoose.Schema({
  reporter: { role: { type: String, required: true }, cnic: Number },
  target: { role: { type: String, enum: ['doctor', 'patient'], required: true }, cnic: { type: Number, required: true } },
  reason: { type: String, enum: ['fake-doctor', 'inappropriate', 'privacy', 'spam', 'other'], required: true },
  details: { type: String, trim: true, maxlength: 1000 },
  status: { type: String, enum: ['open', 'resolved', 'dismissed'], default: 'open' },
  adminNote: { type: String, trim: true, maxlength: 500 },
  resolvedAt: Date,
}, { timestamps: true });

module.exports = mongoose.model('Report', reportSchema);
