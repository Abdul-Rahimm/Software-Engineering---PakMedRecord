const Appointment = require('../models/AppointmentModel');
const Doctor = require('../models/DoctorModel');
const Patient = require('../models/PatientModel');
const Affiliation = require('../models/AffiliationModel');
const { notify } = require('./notify');
const { isFutureDay, isTime } = require('./validate');

const ACTIVE = { $ne: 'cancelled' };

const describe = (a) =>
  `${new Date(a.date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })} at ${a.time}`;

// Shared by the REST endpoint and the AI assistant's booking tool.
// Returns { status, body } so callers can map it to HTTP or a tool result.
const createAppointment = async ({ patientCNIC, doctorCNIC, date, time, reason }) => {
  if (!doctorCNIC || !date || !time) return { status: 400, body: { error: 'Doctor, date and time are required' } };
  if (!isFutureDay(date)) return { status: 400, body: { error: 'Choose today or a future date (YYYY-MM-DD)' } };
  if (!isTime(time)) return { status: 400, body: { error: 'Time must be HH:MM (24-hour)' } };

  const patient = await Patient.findOne({ patientCNIC });
  if (!patient) return { status: 404, body: { error: 'Patient not found' } };
  const doctor = await Doctor.findOne({ doctorCNIC });
  if (!doctor) return { status: 404, body: { error: 'Doctor not found' } };
  if (!(await Affiliation.findOne({ patientCNIC, doctorCNIC }))) {
    return { status: 403, body: { error: 'Patient and doctor are not affiliated' } };
  }
  if (await Appointment.findOne({ doctorCNIC, date, time, status: ACTIVE })) {
    return { status: 409, body: { error: 'Appointment already booked at this time' } };
  }
  if (await Appointment.findOne({ patientCNIC, date, time, status: ACTIVE })) {
    return { status: 409, body: { error: 'You already have an appointment at this time' } };
  }

  const appointment = await Appointment.create({
    patientCNIC,
    doctorCNIC,
    date,
    time,
    reason: reason ? String(reason).trim().slice(0, 300) : undefined,
  });

  notify('doctor', doctorCNIC, {
    type: 'appointment',
    title: 'New appointment',
    body: `${patient.firstName} ${patient.lastName} booked ${describe(appointment)}${appointment.reason ? ` — ${appointment.reason}` : ''}.`,
    link: `/appointments/fetch/${doctorCNIC}`,
  });

  return { status: 201, body: { message: 'Appointment booked successfully.', appointment } };
};

module.exports = { ACTIVE, describe, createAppointment };
