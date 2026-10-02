const mongoose = require('mongoose');

// "Who viewed my record": one row per actor, patient and action in each 10-minute window
const accessLogSchema = new mongoose.Schema({
  patientCNIC: { type: Number, required: true },
  actor: {
    role: { type: String, enum: ['doctor', 'admin', 'public', 'partner', 'share'], required: true },
    cnic: Number,
    id: String,
    name: String,
  },
  action: { type: String, required: true },
  bucket: { type: String, required: true, unique: true },
  count: { type: Number, default: 1 },
  ip: String,
  lastAt: { type: Date, default: Date.now },
}, { timestamps: true });

accessLogSchema.index({ patientCNIC: 1, createdAt: -1 });

module.exports = mongoose.model('AccessLog', accessLogSchema);
