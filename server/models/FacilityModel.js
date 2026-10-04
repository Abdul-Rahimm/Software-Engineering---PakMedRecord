const mongoose = require('mongoose');

// A branch / campus of an organization (one-to-many). Appointments happen at a facility.
const facilitySchema = new mongoose.Schema({
  orgId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true },
  name: { type: String, required: true, trim: true, maxlength: 120 },
  city: { type: String, trim: true, maxlength: 60 },
  district: { type: String, trim: true, maxlength: 60 },
  province: { type: String, trim: true, maxlength: 60 },
  address: { type: String, trim: true, maxlength: 200 },
  phone: { type: String, trim: true, maxlength: 30 },
  active: { type: Boolean, default: true },
}, { timestamps: true });

facilitySchema.index({ orgId: 1, active: 1 });
facilitySchema.index({ city: 1, active: 1 });

module.exports = mongoose.model('Facility', facilitySchema);
