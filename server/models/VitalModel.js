const mongoose = require('mongoose');
const { VITAL_TYPES } = require('./constants');

// One vital-sign reading logged by the patient
const vitalSchema = new mongoose.Schema({
  patientCNIC: { type: Number, required: true, index: true },
  type: { type: String, enum: Object.keys(VITAL_TYPES), required: true },
  value: { type: Number, required: true },
  value2: { type: Number }, // diastolic, for blood pressure
  recordedAt: { type: Date, default: Date.now },
  note: { type: String, trim: true, maxlength: 200 },
}, { timestamps: true });

module.exports = mongoose.model('Vital', vitalSchema);
