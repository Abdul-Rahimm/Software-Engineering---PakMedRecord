const mongoose = require('mongoose');
const { RECORD_CATEGORIES } = require('./constants');

const medicalRecordSchema = new mongoose.Schema({
  patientCNIC: {
    type: Number,
    required: true
  },
  doctorCNIC: {
    type: Number,
    required: function () { return this.source !== 'lab'; }
  },
  // results pushed by a partner laboratory through the partner API
  partner: { id: mongoose.Schema.Types.ObjectId, name: String },
  title: { type: String, trim: true, maxlength: 120 },
  category: { type: String, enum: RECORD_CATEGORIES, default: 'General' },
  recordData: {
    type: String,
    required: true
  },
  attachments: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Attachment' }],
  // 'lab' when sent by a partner lab;
  // 'doctor' when written by the doctor, 'patient' when approved from a patient submission
  source: { type: String, enum: ['doctor', 'patient', 'lab'], default: 'doctor' },
}, { timestamps: true });

const MedicalRecord = mongoose.model('MedicalRecord', medicalRecordSchema);

module.exports = MedicalRecord;
