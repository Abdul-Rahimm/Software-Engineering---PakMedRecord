const mongoose = require('mongoose');

// Server errors, shown to admins (kept 30 days)
const errorLogSchema = new mongoose.Schema({
  message: String,
  stack: String,
  method: String,
  path: String,
  user: String,
  createdAt: { type: Date, default: Date.now, expires: 60 * 60 * 24 * 30 },
});

module.exports = mongoose.model('ErrorLog', errorLogSchema);
