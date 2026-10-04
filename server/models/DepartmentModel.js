const mongoose = require('mongoose');

// A department at an organization, optionally limited to one branch (e.g. Cardiology, OPD)
const departmentSchema = new mongoose.Schema({
  orgId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true },
  facilityId: { type: mongoose.Schema.Types.ObjectId, ref: 'Facility' },
  name: { type: String, required: true, trim: true, maxlength: 80 },
}, { timestamps: true });

departmentSchema.index({ orgId: 1, name: 1 });

module.exports = mongoose.model('Department', departmentSchema);
