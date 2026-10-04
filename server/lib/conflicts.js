// Time clashes for doctors who work in several places. Visits have real lengths (the slot length
// where they were booked), and a doctor can ask for travel time between different hospitals.

const Appointment = require('../models/AppointmentModel');
const Membership = require('../models/MembershipModel');
const Organization = require('../models/OrganizationModel');
const { toMin } = require('./availability');

const ACTIVE = { $nin: ['cancelled', 'no-show'] };
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// Same place = same branch, or both private practice
const placeKey = (x) => (x?.facilityId ? String(x.facilityId) : 'private');

// Does [start, start+len) at `place` clash with appointment `a` once travel time is added?
const clashes = (start, len, place, a, buffer) => {
  const aStart = toMin(a.time);
  const aEnd = aStart + (a.durationMinutes || 30);
  const gap = placeKey(a) === placeKey(place) ? 0 : buffer;
  return start < aEnd + gap && aStart < start + len + gap;
};

// The doctor's and patient's existing visits that clash with a proposed one
const findClash = async ({ doctor, patientCNIC, date, time, durationMinutes, place, excludeId }) => {
  const start = toMin(time);
  const buffer = doctor.travelBufferMinutes || 0;
  const filter = { date, status: ACTIVE, ...(excludeId && { _id: { $ne: excludeId } }) };
  const [mine, theirs] = await Promise.all([
    Appointment.find({ ...filter, doctorCNIC: doctor.doctorCNIC }).select('time durationMinutes facilityId').lean(),
    patientCNIC ? Appointment.find({ ...filter, patientCNIC }).select('time durationMinutes facilityId').lean() : [],
  ]);
  if (mine.some((a) => clashes(start, durationMinutes, place, a, buffer))) return 'doctor';
  if (theirs.some((a) => clashes(start, durationMinutes, place, a, 0))) return 'patient';
  return null;
};

// Which of these slot start times are no longer bookable for the doctor
const blockedSlots = async ({ doctor, date, slots, durationMinutes, place }) => {
  const mine = await Appointment.find({ date, status: ACTIVE, doctorCNIC: doctor.doctorCNIC }).select('time durationMinutes facilityId').lean();
  const buffer = doctor.travelBufferMinutes || 0;
  return slots.filter((t) => mine.some((a) => clashes(toMin(t), durationMinutes, place, a, buffer)));
};

// Weekly hours must not overlap the doctor's hours anywhere else (other hospitals or private practice).
// blocks: [{ facilityId?, day, start, end }] being saved for `here` ({ orgId } or 'private').
// Returns an error message or null.
const scheduleClash = async (doctor, blocks, here) => {
  const buffer = doctor.travelBufferMinutes || 0;
  const others = [];
  const ms = await Membership.find({ doctorCNIC: doctor.doctorCNIC, status: 'active', ...(here !== 'private' && { orgId: { $ne: here.orgId } }) }).lean();
  const orgs = await Organization.find({ _id: { $in: ms.map((m) => m.orgId) } }).select('name').lean();
  for (const m of ms) {
    const name = orgs.find((o) => String(o._id) === String(m.orgId))?.name || 'another hospital';
    for (const b of m.availability?.blocks || []) others.push({ ...b, name });
  }
  if (here !== 'private' && doctor.availability?.days?.length) {
    for (const b of doctor.availability.days) others.push({ ...b, name: 'your private practice' });
  }
  for (const b of blocks) {
    for (const o of others.filter((x) => x.day === b.day)) {
      if (toMin(b.start) < toMin(o.end) + buffer && toMin(o.start) < toMin(b.end) + buffer) {
        return `${DAYS[b.day]} ${b.start}–${b.end} overlaps ${o.start}–${o.end} at ${o.name}${buffer ? ` (with ${buffer} min travel time)` : ''}.`;
      }
    }
  }
  return null;
};

module.exports = { findClash, blockedSlots, scheduleClash, placeKey };
