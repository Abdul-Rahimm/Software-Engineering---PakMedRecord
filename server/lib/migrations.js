// One-time data migrations, run automatically after the database connects. Each is recorded in
// the "migrations" collection so it runs once, and each step is idempotent in case it's interrupted.

const mongoose = require('mongoose');
const Organization = require('../models/OrganizationModel');
const Facility = require('../models/FacilityModel');
const Membership = require('../models/MembershipModel');
const Appointment = require('../models/AppointmentModel');
const Doctor = require('../models/DoctorModel');

// Clinics (one doctor list embedded in the clinic) -> organizations with a main branch and
// doctor memberships (many-to-many), and appointments tagged with organization + branch
const clinicsToOrganizations = async () => {
  const raw = mongoose.connection.db.collection('clinics');
  for (const c of await raw.find({}).toArray()) {
    let main = await Facility.findOne({ orgId: c._id }).sort({ createdAt: 1 });
    if (!main) main = await Facility.create({ orgId: c._id, name: 'Main branch', city: c.city, address: c.address, phone: c.phone });
    for (const d of c.doctors || []) {
      const doctor = await Doctor.findOne({ doctorCNIC: d.doctorCNIC }).lean();
      // carry the doctor's existing weekly hours over to this branch
      const days = doctor?.availability?.days?.length ? doctor.availability.days : [1, 2, 3, 4, 5, 6].map((day) => ({ day, start: '09:00', end: '17:00' }));
      await Membership.updateOne(
        { orgId: c._id, doctorCNIC: d.doctorCNIC },
        { $setOnInsert: {
          roles: d.role === 'admin' ? ['doctor', 'org_admin'] : ['doctor'],
          status: d.status === 'active' ? 'active' : 'invited',
          facilityIds: [main._id],
          fee: doctor?.fee,
          availability: {
            slotMinutes: doctor?.availability?.slotMinutes || 30,
            blocks: days.map((b) => ({ facilityId: main._id, day: b.day, start: b.start, end: b.end })),
            holidays: doctor?.availability?.holidays || [],
            videoConsults: Boolean(doctor?.availability?.videoConsults),
          },
          joinedAt: d.status === 'active' ? new Date() : undefined,
        } },
        { upsert: true }
      );
    }
    const set = { type: c.type || 'clinic' };
    // clinics were created by already-verified doctors, so they start out verified
    if (!c.verification?.status) set.verification = { status: 'verified', reviewedAt: new Date(), note: 'Created before hospital verification existed' };
    if (c.ownerCNIC && !c.createdBy) set.createdBy = { role: 'doctor', id: String(c.ownerCNIC) };
    // additive only: the legacy doctors list stays (ignored by the new code) so a rollback still works
    await raw.updateOne({ _id: c._id }, { $set: set });
    await Appointment.updateMany({ clinicId: c._id, orgId: { $exists: false } }, { $set: { orgId: c._id, facilityId: main._id } });
  }
};

const MIGRATIONS = [['2026-10-organizations', clinicsToOrganizations]];

let running;
const runMigrations = () => {
  running ||= (async () => {
    const log = mongoose.connection.db.collection('migrations');
    for (const [id, fn] of MIGRATIONS) {
      if (await log.findOne({ _id: id })) continue;
      console.log(`Running migration ${id}`);
      await fn();
      await log.insertOne({ _id: id, at: new Date() });
    }
  })().catch((err) => {
    console.error('Migration failed:', err);
    running = undefined; // try again on the next connection
  });
  return running;
};

module.exports = { runMigrations };
