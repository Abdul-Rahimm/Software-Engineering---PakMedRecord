const mongoose = require('mongoose');

// A hospital, clinic or lab: the tenant. Owns its branches, doctor/staff memberships, schedules,
// appointments, payments and invoices. It never owns patients or their medical records.
// Stored in the "clinics" collection so ids created before hospitals existed keep working.
const organizationSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 120 },
  type: { type: String, enum: ['hospital', 'clinic', 'lab', 'diagnostic'], default: 'hospital' },
  // registration with the provincial healthcare commission (e.g. SHCC, PHC, KP HCC, IHRA)
  registrationNo: { type: String, trim: true, maxlength: 60 },
  regulator: { type: String, trim: true, maxlength: 80 },
  city: { type: String, trim: true, maxlength: 60 },
  province: { type: String, enum: ['Punjab', 'Sindh', 'Khyber Pakhtunkhwa', 'Balochistan', 'Islamabad Capital Territory', 'Gilgit-Baltistan', 'Azad Kashmir', ''], default: '' },
  address: { type: String, trim: true, maxlength: 200 },
  phone: { type: String, trim: true, maxlength: 30 },
  email: { type: String, trim: true, lowercase: true, maxlength: 120 },
  website: { type: String, trim: true, maxlength: 120 },
  about: { type: String, trim: true, maxlength: 800 },
  // who created it: a staff (hospital admin) account, or a doctor running their own clinic
  createdBy: { role: { type: String, enum: ['staff', 'doctor'] }, id: String },
  ownerCNIC: { type: Number }, // legacy: doctor who created a clinic before hospitals existed
  // platform verification of the licence/registration; only verified organizations are public
  verification: {
    status: { type: String, enum: ['unverified', 'pending', 'verified', 'rejected'], default: 'unverified' },
    document: { gridId: mongoose.Schema.Types.ObjectId, name: String, mime: String, size: Number },
    note: { type: String, trim: true, maxlength: 500 },
    submittedAt: Date,
    reviewedAt: Date,
  },
  suspended: { type: Boolean, default: false },
}, { timestamps: true, collection: 'clinics' });

organizationSchema.index({ 'verification.status': 1, city: 1 });
organizationSchema.index({ name: 'text' });

organizationSchema.virtual('isPublic').get(function () {
  return this.verification?.status === 'verified' && !this.suspended;
});

organizationSchema.set('toJSON', {
  virtuals: true,
  transform: (doc, ret) => {
    if (ret.verification?.document) delete ret.verification.document.gridId;
    delete ret.doctors; // legacy embedded list, replaced by memberships
    return ret;
  },
});

module.exports = mongoose.models.Organization || mongoose.model('Organization', organizationSchema);
