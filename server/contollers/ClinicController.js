// Clinics: doctors share front-desk staff, a joint schedule and clinic analytics.
// Front-desk staff sign in with email + password and work only inside their clinic.

const bcrypt = require('bcrypt');
const mongoose = require('mongoose');
const expressAsyncHandler = require('express-async-handler');
const Clinic = require('../models/ClinicModel');
const Staff = require('../models/StaffModel');
const Doctor = require('../models/DoctorModel');
const Patient = require('../models/PatientModel');
const Appointment = require('../models/AppointmentModel');
const { notify } = require('../lib/notify');
const { isCNIC, isEmail } = require('../lib/validate');
const { completeSignIn } = require('../lib/session');
const { createAppointment, describe } = require('../lib/appointments');
const { slotsFor } = require('../lib/availability');
const { forgetAccountStatus } = require('../middleware/auth');
const { flagRefund } = require('./PaymentController');

const doctorFields = 'doctorCNIC firstName lastName specialization hospital fee availability verification';

const activeDoctors = (clinic) => clinic.doctors.filter((d) => d.status === 'active').map((d) => d.doctorCNIC);

// ---------- doctor side ----------

const mine = expressAsyncHandler(async (req, res) => {
  const clinic = await Clinic.findOne({ 'doctors.doctorCNIC': req.user.cnic });
  if (!clinic) return res.status(200).json({ clinic: null });
  const [doctors, staff] = await Promise.all([
    Doctor.find({ doctorCNIC: { $in: clinic.doctors.map((d) => d.doctorCNIC) } }).select(doctorFields).lean(),
    Staff.find({ clinicId: clinic._id }).select('name email role disabled createdAt'),
  ]);
  const me = clinic.doctors.find((d) => d.doctorCNIC === req.user.cnic);
  res.status(200).json({
    clinic,
    myRole: me.role,
    myStatus: me.status,
    members: clinic.doctors.map((m) => ({ ...m.toObject(), doctor: doctors.find((d) => d.doctorCNIC === m.doctorCNIC) || null })),
    staff: me.role === 'admin' ? staff : [],
  });
});

const create = expressAsyncHandler(async (req, res) => {
  if (!req.user.verified) return res.status(403).json({ error: 'Get your PMDC registration verified before creating a clinic.' });
  if (await Clinic.exists({ 'doctors.doctorCNIC': req.user.cnic })) return res.status(409).json({ error: 'You are already part of a clinic' });
  const { name, city, address, phone } = req.body || {};
  if (!String(name || '').trim()) return res.status(400).json({ error: 'Enter the clinic name' });
  const clinic = await Clinic.create({
    name: String(name).trim(), city: String(city || '').trim(), address: String(address || '').trim(), phone: String(phone || '').trim(),
    ownerCNIC: req.user.cnic, doctors: [{ doctorCNIC: req.user.cnic, role: 'admin', status: 'active' }],
  });
  await Doctor.updateOne({ doctorCNIC: req.user.cnic }, { clinicId: clinic._id });
  forgetAccountStatus('doctor', req.user.cnic);
  res.status(201).json({ message: 'Clinic created', clinic });
});

const loadAsAdmin = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    res.status(404).json({ error: 'Clinic not found' });
    return null;
  }
  const clinic = await Clinic.findById(req.params.id);
  const me = clinic?.doctors.find((d) => d.doctorCNIC === req.user.cnic && d.status === 'active');
  if (!clinic || !me) {
    res.status(404).json({ error: 'Clinic not found' });
    return null;
  }
  if (me.role !== 'admin') {
    res.status(403).json({ error: 'Only clinic admins can do this' });
    return null;
  }
  return clinic;
};

const update = expressAsyncHandler(async (req, res) => {
  const clinic = await loadAsAdmin(req, res);
  if (!clinic) return;
  for (const k of ['name', 'city', 'address', 'phone']) if (req.body?.[k] !== undefined) clinic[k] = String(req.body[k]).trim();
  await clinic.save();
  res.status(200).json({ message: 'Clinic updated', clinic });
});

const invite = expressAsyncHandler(async (req, res) => {
  const clinic = await loadAsAdmin(req, res);
  if (!clinic) return;
  const cnic = Number(String(req.body?.doctorCNIC || '').replace(/\D/g, ''));
  if (!isCNIC(cnic)) return res.status(400).json({ error: 'Enter the doctor\'s 13-digit CNIC' });
  const doctor = await Doctor.findOne({ doctorCNIC: cnic });
  if (!doctor) return res.status(404).json({ error: 'No doctor with that CNIC' });
  if (await Clinic.exists({ 'doctors.doctorCNIC': cnic })) return res.status(409).json({ error: 'That doctor is already in a clinic' });
  clinic.doctors.push({ doctorCNIC: cnic, role: req.body?.role === 'admin' ? 'admin' : 'doctor', status: 'invited' });
  await clinic.save();
  notify('doctor', cnic, { type: 'clinic', title: 'Clinic invitation', body: `You were invited to join ${clinic.name}.`, link: `/clinic/${cnic}` });
  res.status(200).json({ message: 'Invitation sent' });
});

// Invited doctor accepts or declines
const respond = expressAsyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: 'Invitation not found' });
  const clinic = await Clinic.findById(req.params.id);
  const me = clinic?.doctors.find((d) => d.doctorCNIC === req.user.cnic && d.status === 'invited');
  if (!me) return res.status(404).json({ error: 'Invitation not found' });
  if (req.body?.accept) {
    me.status = 'active';
    await Doctor.updateOne({ doctorCNIC: req.user.cnic }, { clinicId: clinic._id });
  } else {
    clinic.doctors = clinic.doctors.filter((d) => d.doctorCNIC !== req.user.cnic);
  }
  await clinic.save();
  forgetAccountStatus('doctor', req.user.cnic);
  res.status(200).json({ message: req.body?.accept ? `You joined ${clinic.name}` : 'Invitation declined' });
});

const removeMember = expressAsyncHandler(async (req, res) => {
  const cnic = Number(req.params.doctorCNIC);
  const leaving = cnic === req.user.cnic;
  const clinic = leaving ? await Clinic.findOne({ _id: req.params.id, 'doctors.doctorCNIC': cnic }) : await loadAsAdmin(req, res);
  if (!clinic) return leaving ? res.status(404).json({ error: 'Clinic not found' }) : undefined;
  const admins = clinic.doctors.filter((d) => d.role === 'admin' && d.status === 'active' && d.doctorCNIC !== cnic);
  if (clinic.doctors.some((d) => d.doctorCNIC === cnic && d.role === 'admin') && !admins.length) {
    return res.status(400).json({ error: 'Make another doctor an admin first' });
  }
  clinic.doctors = clinic.doctors.filter((d) => d.doctorCNIC !== cnic);
  await clinic.save();
  await Doctor.updateOne({ doctorCNIC: cnic }, { $unset: { clinicId: 1 } });
  res.status(200).json({ message: leaving ? 'You left the clinic' : 'Doctor removed' });
});

const addStaff = expressAsyncHandler(async (req, res) => {
  const clinic = await loadAsAdmin(req, res);
  if (!clinic) return;
  const { name, email, password } = req.body || {};
  if (!String(name || '').trim() || !isEmail(email)) return res.status(400).json({ error: 'Enter a name and email' });
  if (String(password || '').length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });
  if (await Staff.exists({ email: String(email).toLowerCase().trim() })) return res.status(409).json({ error: 'That email already has a staff account' });
  const staff = await Staff.create({ clinicId: clinic._id, name: String(name).trim(), email, password: await bcrypt.hash(String(password), 10) });
  res.status(201).json({ message: 'Front-desk account created', staff });
});

const setStaff = expressAsyncHandler(async (req, res) => {
  const clinic = await loadAsAdmin(req, res);
  if (!clinic) return;
  if (!mongoose.isValidObjectId(req.params.staffId)) return res.status(404).json({ error: 'Staff not found' });
  const staff = await Staff.findOne({ _id: req.params.staffId, clinicId: clinic._id });
  if (!staff) return res.status(404).json({ error: 'Staff not found' });
  if (req.body?.remove) {
    await staff.deleteOne();
  } else {
    staff.disabled = Boolean(req.body?.disabled);
    if (req.body?.password) {
      if (String(req.body.password).length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });
      staff.password = await bcrypt.hash(String(req.body.password), 10);
      staff.passwordChangedAt = new Date(Date.now() - 1000);
    }
    await staff.save();
  }
  forgetAccountStatus('staff', String(staff._id));
  res.status(200).json({ message: 'Saved' });
});

// ---------- front desk (staff) ----------

const staffSignin = expressAsyncHandler(async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const staff = await Staff.findOne({ email });
  if (!staff || !(await bcrypt.compare(String(req.body?.password || ''), staff.password))) return res.status(401).json({ error: 'Invalid credentials' });
  const { status, body } = completeSignIn('staff', staff, 'Signed in');
  res.status(status).json(body);
});

const deskContext = async (req, res) => {
  const staff = await Staff.findById(req.user.id);
  const clinic = staff && (await Clinic.findById(staff.clinicId));
  if (!clinic) {
    res.status(404).json({ error: 'Clinic not found' });
    return null;
  }
  return { staff, clinic, doctorCNICs: activeDoctors(clinic) };
};

// GET /desk/day?date=YYYY-MM-DD -> every doctor's schedule for the day
const deskDay = expressAsyncHandler(async (req, res) => {
  const ctx = await deskContext(req, res);
  if (!ctx) return;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(String(req.query.date)) ? req.query.date : new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Karachi' });
  const [doctors, appointments] = await Promise.all([
    Doctor.find({ doctorCNIC: { $in: ctx.doctorCNICs } }).select(doctorFields).lean(),
    Appointment.find({ doctorCNIC: { $in: ctx.doctorCNICs }, date }).sort({ time: 1 }).lean(),
  ]);
  const patients = await Patient.find({ patientCNIC: { $in: appointments.map((a) => a.patientCNIC) } }).select('patientCNIC firstName lastName gender phone').lean();
  res.status(200).json({
    date,
    clinic: { _id: ctx.clinic._id, name: ctx.clinic.name, city: ctx.clinic.city },
    staff: { name: ctx.staff.name, email: ctx.staff.email },
    doctors: doctors.map((d) => ({ ...d, slots: slotsFor(d, date) })),
    appointments: appointments.map((a) => ({ ...a, patient: patients.find((p) => p.patientCNIC === a.patientCNIC) || null })),
  });
});

// Confirms identity at the desk: name and phone only
const deskPatient = expressAsyncHandler(async (req, res) => {
  const ctx = await deskContext(req, res);
  if (!ctx) return;
  const cnic = Number(String(req.params.cnic).replace(/\D/g, ''));
  const p = await Patient.findOne({ patientCNIC: cnic }).select('patientCNIC firstName lastName gender phone dateOfBirth').lean();
  if (!p) return res.status(404).json({ error: 'No patient with that CNIC. Ask them to sign up on PakMedRecord first.' });
  res.status(200).json(p);
});

const deskBook = expressAsyncHandler(async (req, res) => {
  const ctx = await deskContext(req, res);
  if (!ctx) return;
  const doctorCNIC = Number(req.body?.doctorCNIC);
  if (!ctx.doctorCNICs.includes(doctorCNIC)) return res.status(403).json({ error: 'That doctor is not in your clinic' });
  const { status, body } = await createAppointment({
    ...req.body, patientCNIC: Number(String(req.body?.patientCNIC || '').replace(/\D/g, '')), doctorCNIC,
    bookedBy: { role: 'staff', id: String(ctx.staff._id) }, clinicId: ctx.clinic._id,
  });
  res.status(status).json(body);
});

// { action: 'check-in' | 'no-show' | 'cancel' }
const deskUpdate = expressAsyncHandler(async (req, res) => {
  const ctx = await deskContext(req, res);
  if (!ctx) return;
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: 'Appointment not found' });
  const a = await Appointment.findById(req.params.id);
  if (!a || !ctx.doctorCNICs.includes(a.doctorCNIC)) return res.status(404).json({ error: 'Appointment not found' });
  const action = req.body?.action;
  if (a.status !== 'pending' && action !== 'undo-check-in') return res.status(409).json({ error: `This appointment is ${a.status}` });
  if (action === 'check-in') {
    a.checkedInAt = new Date();
    notify('doctor', a.doctorCNIC, { type: 'checkin', title: 'Patient checked in', body: `Your ${a.time} patient has arrived.`, link: `/appointments/fetch/${a.doctorCNIC}` });
  } else if (action === 'undo-check-in') a.checkedInAt = undefined;
  else if (action === 'no-show') a.status = 'no-show';
  else if (action === 'cancel') {
    a.status = 'cancelled';
    a.cancelledBy = 'doctor';
    a.cancelReason = String(req.body?.reason || 'Cancelled by the clinic').slice(0, 300);
    await flagRefund(a);
    notify('patient', a.patientCNIC, { type: 'cancelled', title: 'Appointment cancelled', body: `The clinic cancelled your appointment on ${describe(a)}: ${a.cancelReason}`, link: `/appointments/mine/${a.patientCNIC}` });
  } else return res.status(400).json({ error: 'Unknown action' });
  await a.save();
  res.status(200).json({ message: 'Updated', appointment: a });
});

module.exports = {
  mine, create, update, invite, respond, removeMember, addStaff, setStaff, staffSignin, deskDay, deskPatient, deskBook, deskUpdate, activeDoctors,
};
