const crypto = require('crypto');
const mongoose = require('mongoose');
const Appointment = require('../models/AppointmentModel');
const Doctor = require('../models/DoctorModel');
const Patient = require('../models/PatientModel');
const Affiliation = require('../models/AffiliationModel');
const Organization = require('../models/OrganizationModel');
const Membership = require('../models/MembershipModel');
const Facility = require('../models/FacilityModel');
const { notify } = require('./notify');
const { isFutureDay, isTime } = require('./validate');
const { slotsFor, scheduleOf, membershipSlots } = require('./availability');
const { findClash } = require('./conflicts');

const ACTIVE = { $nin: ['cancelled'] };

const describe = (a) =>
  `${new Date(a.date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })} at ${a.time}`;

const isVerified = (d) => !d.verification?.status || d.verification.status === 'verified';

// Where and how a doctor can be booked: a branch of an organization (orgId + facilityId) or,
// with neither, their private practice. Returns { error } or { slots, fee, videoConsults, org, facility, membership }.
const resolveLocation = async (doctor, { orgId, facilityId }, date) => {
  if (!orgId && !facilityId) {
    // private practice is bookable when the doctor has private hours or practises at no public hospital
    const { doctorLocations } = require('./tenancy');
    if (!(await doctorLocations(doctor.doctorCNIC)).some((l) => l.kind === 'private')) return { error: 'Choose which hospital or branch to book at' };
    const s = scheduleOf(doctor);
    return { slots: date ? slotsFor(doctor, date) : [], fee: doctor.fee, videoConsults: s.videoConsults, slotMinutes: s.slotMinutes, label: doctor.clinicAddress || doctor.hospital || 'Private practice' };
  }
  if (!mongoose.isValidObjectId(orgId) || !mongoose.isValidObjectId(facilityId)) return { error: 'Choose a valid hospital branch' };
  const [org, facility, membership] = await Promise.all([
    Organization.findById(orgId).lean(),
    Facility.findOne({ _id: facilityId, orgId, active: true }).lean(),
    Membership.findOne({ orgId, doctorCNIC: doctor.doctorCNIC, status: 'active', roles: 'doctor' }).lean(),
  ]);
  if (!org || org.suspended || org.verification?.status !== 'verified') return { error: 'This hospital is not available for booking' };
  if (!facility) return { error: 'Branch not found' };
  if (!membership || !(membership.facilityIds || []).map(String).includes(String(facilityId))) return { error: 'This doctor does not see patients at that branch' };
  return {
    org, facility, membership,
    slots: date ? membershipSlots(membership, facilityId, date) : [],
    fee: membership.fee ?? doctor.fee,
    videoConsults: Boolean(membership.availability?.videoConsults),
    slotMinutes: membership.availability?.slotMinutes || 30,
    label: `${org.name}, ${facility.name}`,
  };
};

// Shared by the REST endpoint, hospital front desk and the AI assistant's booking tool.
// Returns { status, body } so callers can map it to HTTP or a tool result.
// bookedBy: { role: 'patient' | 'staff' | 'assistant', id }. Hospital staff can book without an existing care grant.
const createAppointment = async ({ patientCNIC, doctorCNIC, date, time, reason, mode, orgId, facilityId, bookedBy = { role: 'patient' }, excludeId }) => {
  if (!doctorCNIC || !date || !time) return { status: 400, body: { error: 'Doctor, date and time are required' } };
  if (!isFutureDay(date)) return { status: 400, body: { error: 'Choose today or a future date (YYYY-MM-DD)' } };
  if (!isTime(time)) return { status: 400, body: { error: 'Time must be HH:MM (24-hour)' } };
  const visitMode = mode === 'video' ? 'video' : 'in-person';

  const patient = await Patient.findOne({ patientCNIC });
  if (!patient) return { status: 404, body: { error: 'Patient not found' } };
  const doctor = await Doctor.findOne({ doctorCNIC });
  if (!doctor || doctor.disabled) return { status: 404, body: { error: 'Doctor not found' } };
  if (!isVerified(doctor)) return { status: 403, body: { error: 'This doctor is not verified yet' } };
  if (bookedBy.role !== 'staff' && !(await Affiliation.findOne({ patientCNIC, doctorCNIC }))) {
    return { status: 403, body: { error: 'Patient and doctor are not affiliated' } };
  }
  const place = await resolveLocation(doctor, { orgId, facilityId }, date);
  if (place.error) return { status: 400, body: { error: place.error } };
  if (!place.slots.includes(time)) {
    return { status: 400, body: { error: 'The doctor is not available at that time. Pick one of the open slots.' } };
  }
  if (visitMode === 'video' && !place.videoConsults) {
    return { status: 400, body: { error: 'This doctor does not offer video consultations here' } };
  }
  // a doctor can't be in two places at once, whichever hospital it is (visit length + travel time)
  const clash = await findClash({ doctor, patientCNIC, date, time, durationMinutes: place.slotMinutes, place: { facilityId: facilityId || null }, excludeId });
  if (clash === 'doctor') return { status: 409, body: { error: 'The doctor is busy at that time (another visit, or travelling from another hospital). Pick another slot.' } };
  if (clash === 'patient') return { status: 409, body: { error: 'This patient already has an appointment at this time' } };

  const appointment = await Appointment.create({
    patientCNIC,
    doctorCNIC,
    date,
    time,
    reason: reason ? String(reason).trim().slice(0, 300) : undefined,
    mode: visitMode,
    durationMinutes: place.slotMinutes,
    roomId: visitMode === 'video' ? crypto.randomBytes(12).toString('hex') : undefined,
    fee: place.fee || undefined,
    payment: { status: 'unpaid', method: '' },
    bookedBy,
    ...(place.org && { orgId: place.org._id, facilityId: place.facility._id, departmentId: place.membership.departmentId }),
  });

  notify('doctor', doctorCNIC, {
    type: 'appointment',
    title: visitMode === 'video' ? 'New video appointment' : 'New appointment',
    body: `${patient.firstName} ${patient.lastName} booked ${describe(appointment)} at ${place.label}${appointment.reason ? ` — ${appointment.reason}` : ''}.`,
    link: `/appointments/fetch/${doctorCNIC}`,
  });
  if (bookedBy.role === 'staff') {
    notify('patient', patientCNIC, {
      type: 'appointment',
      title: 'Appointment booked',
      body: `${place.label} booked you with Dr. ${doctor.firstName} ${doctor.lastName} on ${describe(appointment)}.`,
      link: `/appointments/mine/${patientCNIC}`,
    });
  }

  return { status: 201, body: { message: 'Appointment booked successfully.', appointment } };
};

// Future appointments that can no longer happen as booked (doctor left, branch closed, hospital
// suspended): flag them and tell the patient on every channel, so they can move or cancel.
const NOTICE_TEXT = {
  doctor_left: (a, where) => `Dr. ${a.doctorName} no longer sees patients at ${where}. Move your ${describe(a)} appointment to another hospital where they practise, or cancel it.`,
  branch_closed: (a, where) => `${where} has closed. Move your ${describe(a)} appointment to another branch, or cancel it.`,
  org_suspended: (a, where) => `${where} is not taking appointments on PakMedRecord right now. Move your ${describe(a)} appointment, or cancel it.`,
};
const flagFutureAppointments = async (filter, notice) => {
  const { deliver } = require('./messaging');
  const today = new Date(new Date().toISOString().slice(0, 10));
  const list = await Appointment.find({ ...filter, status: 'pending', date: { $gte: today } });
  if (!list.length) return 0;
  const [orgs, facilities, doctors] = await Promise.all([
    Organization.find({ _id: { $in: list.map((a) => a.orgId) } }).select('name').lean(),
    Facility.find({ _id: { $in: list.map((a) => a.facilityId) } }).select('name').lean(),
    Doctor.find({ doctorCNIC: { $in: list.map((a) => a.doctorCNIC) } }).select('doctorCNIC firstName lastName').lean(),
  ]);
  for (const a of list) {
    a.notice = notice;
    await a.save();
    const org = orgs.find((o) => String(o._id) === String(a.orgId));
    const f = facilities.find((x) => String(x._id) === String(a.facilityId));
    const d = doctors.find((x) => x.doctorCNIC === a.doctorCNIC);
    const where = [org?.name, notice === 'branch_closed' ? f?.name : null].filter(Boolean).join(', ') || 'the hospital';
    const patient = await Patient.findOne({ patientCNIC: a.patientCNIC });
    if (!patient) continue;
    const guardian = patient.guardianCNIC ? await Patient.findOne({ patientCNIC: patient.guardianCNIC }) : null;
    deliver(patient, {
      type: 'appointment', title: 'Your appointment needs to move',
      body: NOTICE_TEXT[notice]({ ...a.toObject(), doctorName: d ? `${d.firstName} ${d.lastName}` : '' }, where),
      link: `/appointments/mine/${a.patientCNIC}`,
    }, guardian).catch((err) => console.error('Notice delivery failed:', err.message));
  }
  return list.length;
};

// Undo a notice when the reason goes away (branch reopened, hospital restored)
const clearNotice = (filter, notice) => Appointment.updateMany({ ...filter, notice }, { notice: '' });

module.exports = { ACTIVE, describe, createAppointment, resolveLocation, flagFutureAppointments, clearNotice };
