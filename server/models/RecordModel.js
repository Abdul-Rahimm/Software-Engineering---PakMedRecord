const mongoose = require('mongoose');

const medicalRecordSchema = new mongoose.Schema({
  patientCNIC: {
    type: Number,
    required: true
  },
  doctorCNIC: {
    type: Number,
    required: true
  },
  recordData: {
    type: String,
    required: true
  }
}, { timestamps: true });

const MedicalRecord = mongoose.model('MedicalRecord', medicalRecordSchema);

module.exports = MedicalRecord;
