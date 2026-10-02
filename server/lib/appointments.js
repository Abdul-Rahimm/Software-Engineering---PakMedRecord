const crypto = require('crypto');
const Appointment = require('../models/AppointmentModel');
const Doctor = require('../models/DoctorModel');
const Patient = require('../models/PatientModel');
const Affiliation = require('../models/AffiliationModel');
const { notify } = require('./notify');
const { isFutureDay, isTime } = require('./validate');
const { slotsFor, scheduleOf } = require('./availability');

const ACTIVE = { $nin: ['cancelled'] };

const describe = (a) =>
  `${new Date(a.date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })} at ${a.time}`;

const isVerified = (d) => !d.verification?.status || d.verification.status === 'verified';

// Shared by the REST endpoint, clinic front desk and the AI assistant's booking tool.
// Returns { status, body } so callers can map it to HTTP or a tool result.
// bookedBy: { role: 'patient' | 'staff' | 'assistant', id }. Staff can book without an existing affiliation.
const createAppointment = async ({ patientCNIC, doctorCNIC, date, time, reason, mode, bookedBy = { role: 'patient' }, clinicId }) => {
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
  if (!slotsFor(doctor, date).includes(time)) {
    return { status: 400, body: { error: 'The doctor is not available at that time. Pick one of the open slots.' } };
  }
  if (visitMode === 'video' && !scheduleOf(doctor).videoConsults) {
    return { status: 400, body: { error: 'This doctor does not offer video consultations' } };
  }
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
    fee: doctor.fee || undefined,
    payment: { status: 'unpaid', method: '' },
    bookedBy,
    clinicId: clinicId || doctor.clinicId,
  });

  notify('doctor', doctorCNIC, {
    type: 'appointment',
    title: visitMode === 'video' ? 'New video appointment' : 'New appointment',
    body: `${patient.firstName} ${patient.lastName} booked ${describe(appointment)}${appointment.reason ? ` — ${appointment.reason}` : ''}.`,
    link: `/appointments/fetch/${doctorCNIC}`,
  });
  if (bookedBy.role === 'staff') {
    notify('patient', patientCNIC, {
      type: 'appointment',
      title: 'Appointment booked',
      body: `The clinic booked you with Dr. ${doctor.firstName} ${doctor.lastName} on ${describe(appointment)}.`,
      link: `/appointments/mine/${patientCNIC}`,
    });
  }

  return { status: 201, body: { message: 'Appointment booked successfully.', appointment } };
};

module.exports = { ACTIVE, describe, createAppointment };
