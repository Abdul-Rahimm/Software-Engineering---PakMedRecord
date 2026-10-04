const mongoose = require('mongoose');

// Doctor <-> Organization (many-to-many). A doctor can work at several hospitals, and each
// membership has its own branches, department, fee and weekly schedule there.
const blockSchema = new mongoose.Schema({
  facilityId: { type: mongoose.Schema.Types.ObjectId, ref: 'Facility', required: true },
  day: { type: Number, min: 0, max: 6, required: true },
  start: { type: String, required: true },
  end: { type: String, required: true },
}, { _id: false });

const membershipSchema = new mongoose.Schema({
  orgId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true },
  doctorCNIC: { type: Number, required: true },
  // 'org_admin' lets a doctor manage the organization (e.g. their own clinic)
  roles: { type: [{ type: String, enum: ['doctor', 'org_admin'] }], default: ['doctor'] },
  status: { type: String, enum: ['invited', 'active', 'declined', 'removed'], default: 'invited' },
  facilityIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Facility' }],
  departmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Department' },
  fee: { type: Number, min: 0, max: 100000 },
  availability: {
    slotMinutes: { type: Number, enum: [10, 15, 20, 30, 45, 60], default: 30 },
    blocks: [blockSchema],
    holidays: [{ type: String }],
    videoConsults: { type: Boolean, default: false },
  },
  invitedBy: { role: String, id: String },
  joinedAt: Date,
}, { timestamps: true });

membershipSchema.index({ orgId: 1, doctorCNIC: 1 }, { unique: true });
membershipSchema.index({ doctorCNIC: 1, status: 1 });
membershipSchema.index({ orgId: 1, status: 1 });

module.exports = mongoose.model('Membership', membershipSchema);
