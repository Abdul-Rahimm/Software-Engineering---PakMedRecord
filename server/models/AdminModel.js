const mongoose = require('mongoose');
const { accountFields } = require('./accountFields');

// Platform administrator (verifies doctors, handles reports, manages partners)
const adminSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  name: { type: String, required: true, trim: true },
  password: { type: String, required: true },
  ...accountFields,
}, { timestamps: true });

adminSchema.set('toJSON', { transform: (doc, ret) => { delete ret.password; return ret; } });

module.exports = mongoose.model('Admin', adminSchema);
