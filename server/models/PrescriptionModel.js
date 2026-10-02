const mongoose = require('mongoose');

// Structured e-prescription. `code` is printed as a QR so pharmacies can verify it.
const itemSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 120 },
  dose: { type: String, trim: true, maxlength: 60 },
  frequency: { type: String, trim: true, maxlength: 60 },
  durationDays: { type: Number, min: 0, max: 365 },
  instructions: { type: String, trim: true, maxlength: 200 },
}, { _id: false });

const prescriptionSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true },
  patientCNIC: { type: Number, required: true, index: true },
  doctorCNIC: { type: Number, required: true, index: true },
  diagnosis: { type: String, trim: true, maxlength: 300 },
  items: { type: [itemSchema], validate: [(v) => v.length > 0 && v.length <= 20, 'Add 1-20 medicines'] },
  notes: { type: String, trim: true, maxlength: 600 },
  status: { type: String, enum: ['active', 'dispensed', 'cancelled'], default: 'active' },
  dispensed: { by: String, at: Date },
  recordId: { type: mongoose.Schema.Types.ObjectId, ref: 'MedicalRecord' },
}, { timestamps: true });

module.exports = mongoose.model('Prescription', prescriptionSchema);
