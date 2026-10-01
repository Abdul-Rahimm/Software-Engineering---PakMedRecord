const mongoose = require('mongoose');

// In-app notification for a doctor or a patient
const notificationSchema = new mongoose.Schema({
  role: { type: String, enum: ['doctor', 'patient'], required: true },
  cnic: { type: Number, required: true },
  type: { type: String, required: true },
  title: { type: String, required: true },
  body: { type: String },
  link: { type: String },
  read: { type: Boolean, default: false },
}, { timestamps: true });

notificationSchema.index({ role: 1, cnic: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
