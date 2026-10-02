const mongoose = require('mongoose');
const { RECORD_CATEGORIES } = require('./constants');

const medicalRecordSchema = new mongoose.Schema({
  patientCNIC: {
    type: Number,
    required: true
  },
  doctorCNIC: {
    type: Number,
    required: true
  },
  title: { type: String, trim: true, maxlength: 120 },
  category: { type: String, enum: RECORD_CATEGORIES, default: 'General' },
  recordData: {
    type: String,
    required: true
  },
  attachments: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Attachment' }],
  // 'doctor' when written by the doctor, 'patient' when approved from a patient submission
  source: { type: String, enum: ['doctor', 'patient'], default: 'doctor' },
}, { timestamps: true });

const MedicalRecord = mongoose.model('MedicalRecord', medicalRecordSchema);

module.exports = MedicalRecord;
