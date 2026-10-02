const mongoose = require('mongoose');

// Remembers which reminders were already sent so the daily job never repeats one
const reminderLogSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  createdAt: { type: Date, default: Date.now, expires: 60 * 60 * 24 * 120 },
});

module.exports = mongoose.model('ReminderLog', reminderLogSchema);
