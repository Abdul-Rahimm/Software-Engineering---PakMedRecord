const mongoose = require('mongoose');
const { accountFields } = require('./accountFields');

// Hospital/clinic staff accounts (email + password). clinicId is the organization they belong to.
const staffSchema = new mongoose.Schema({
  clinicId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  name: { type: String, required: true, trim: true, maxlength: 80 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true },
  // hospital accounts: org_admin runs the organization; facility_admin/reception/billing work at given branches
  role: { type: String, enum: ['org_admin', 'facility_admin', 'reception', 'billing'], default: 'reception' },
  facilityIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Facility' }], // empty = all branches
  ...accountFields,
}, { timestamps: true });

staffSchema.set('toJSON', { transform: (doc, ret) => { delete ret.password; return ret; } });

module.exports = mongoose.model('Staff', staffSchema);
