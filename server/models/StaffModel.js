const mongoose = require('mongoose');
const { accountFields } = require('./accountFields');

// Clinic front-desk staff: manage the clinic's schedule, check patients in, take walk-in bookings
const staffSchema = new mongoose.Schema({
  clinicId: { type: mongoose.Schema.Types.ObjectId, ref: 'Clinic', required: true, index: true },
  name: { type: String, required: true, trim: true, maxlength: 80 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['reception'], default: 'reception' },
  ...accountFields,
}, { timestamps: true });

staffSchema.set('toJSON', { transform: (doc, ret) => { delete ret.password; return ret; } });

module.exports = mongoose.model('Staff', staffSchema);
