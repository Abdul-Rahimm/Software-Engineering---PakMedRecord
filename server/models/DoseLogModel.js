const mongoose = require('mongoose');

// One scheduled medicine dose the patient ticked off (or skipped)
const doseLogSchema = new mongoose.Schema({
  patientCNIC: { type: Number, required: true },
  med: { type: String, required: true }, // medicine name, lower-case
  date: { type: String, required: true }, // YYYY-MM-DD
  time: { type: String, required: true }, // HH:MM
  status: { type: String, enum: ['taken', 'skipped'], default: 'taken' },
}, { timestamps: true });

doseLogSchema.index({ patientCNIC: 1, med: 1, date: 1, time: 1 }, { unique: true });

module.exports = mongoose.model('DoseLog', doseLogSchema);
