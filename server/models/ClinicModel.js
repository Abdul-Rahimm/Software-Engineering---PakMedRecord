const mongoose = require('mongoose');

// A clinic or hospital department: several doctors sharing front-desk staff and a schedule
const clinicSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 100 },
  city: { type: String, trim: true, maxlength: 60 },
  address: { type: String, trim: true, maxlength: 200 },
  phone: { type: String, trim: true, maxlength: 30 },
  ownerCNIC: { type: Number, required: true },
  doctors: [{
    _id: false,
    doctorCNIC: { type: Number, required: true },
    role: { type: String, enum: ['admin', 'doctor'], default: 'doctor' },
    status: { type: String, enum: ['invited', 'active'], default: 'invited' },
  }],
}, { timestamps: true });

clinicSchema.index({ 'doctors.doctorCNIC': 1 });

module.exports = mongoose.model('Clinic', clinicSchema);
