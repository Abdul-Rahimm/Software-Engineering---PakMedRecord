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
    return { slots: date ? slotsFor(doctor, date) : [], fee: doctor.fee, videoConsults: s.videoConsults, label: doctor.clinicAddress || doctor.hospital || 'Private practice' };
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
    label: `${org.name}, ${facility.name}`,
  };
};

// Shared by the REST endpoint, hospital front desk and the AI assistant's booking tool.
// Returns { status, body } so callers can map it to HTTP or a tool result.
// bookedBy: { role: 'patient' | 'staff' | 'assistant', id }. Hospital staff can book without an existing care grant.
const createAppointment = async ({ patientCNIC, doctorCNIC, date, time, reason, mode, orgId, facilityId, bookedBy = { role: 'patient' } }) => {
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
  // a doctor can't be in two places at once, whichever hospital it is
  if (await Appointment.findOne({ doctorCNIC, date, time, status: ACTIVE })) {
    return { status: 409, body: { error: 'Appointment already booked at this time' } };
  }
  if (await Appointment.findOne({ patientCNIC, date, time, status: ACTIVE })) {
    return { status: 409, body: { error: 'This patient already has an appointment at this time' } };
  }

  const appointment = await Appointment.create({
    patientCNIC,
    doctorCNIC,
    date,
    time,
    reason: reason ? String(reason).trim().slice(0, 300) : undefined,
    mode: visitMode,
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

module.exports = { ACTIVE, describe, createAppointment, resolveLocation };
