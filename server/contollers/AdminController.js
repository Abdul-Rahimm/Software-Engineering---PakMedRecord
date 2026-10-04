// Platform administration: doctor verification, account moderation, reports, partners, health.

const crypto = require('crypto');
const bcrypt = require('bcrypt');
const mongoose = require('mongoose');
const expressAsyncHandler = require('express-async-handler');
const Admin = require('../models/AdminModel');
const Doctor = require('../models/DoctorModel');
const Patient = require('../models/PatientModel');
const MedicalRecord = require('../models/RecordModel');
const Appointment = require('../models/AppointmentModel');
const Attachment = require('../models/AttachmentModel');
const Report = require('../models/ReportModel');
const Partner = require('../models/PartnerModel');
const ErrorLog = require('../models/ErrorLogModel');
const Prescription = require('../models/PrescriptionModel');
const Clinic = require('../models/ClinicModel');
const Facility = require('../models/FacilityModel');
const Membership = require('../models/MembershipModel');
const Staff = require('../models/StaffModel');
const { completeSignIn } = require('../lib/session');
const { openFileStream } = require('../lib/files');
const { notify } = require('../lib/notify');
const { mailEnabled, sendMail, brandedEmail } = require('../lib/mailer');
const { forgetAccountStatus } = require('../middleware/auth');
const { hashToken, APP_URL } = require('../lib/accounts');

// The first admin can be created from ADMIN_EMAIL / ADMIN_PASSWORD on first sign-in
const bootstrap = async (email, password) => {
  if (!process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD) return null;
  if (email !== process.env.ADMIN_EMAIL.toLowerCase() || password !== process.env.ADMIN_PASSWORD) return null;
  if (await Admin.countDocuments()) return null;
  return Admin.create({ email, name: process.env.ADMIN_NAME || 'Administrator', password: await bcrypt.hash(password, 10) });
};

const signin = expressAsyncHandler(async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  if (!email || !password) return res.status(400).json({ error: 'Enter your email and password' });
  let admin = await Admin.findOne({ email });
  if (!admin) admin = await bootstrap(email, password);
  if (!admin || !(await bcrypt.compare(password, admin.password))) return res.status(401).json({ error: 'Invalid credentials' });
  const { status, body } = completeSignIn('admin', admin, 'Signed in');
  res.status(status).json(body);
});

const me = expressAsyncHandler(async (req, res) => {
  res.status(200).json(await Admin.findById(req.user.id));
});

const stats = expressAsyncHandler(async (req, res) => {
  const since = new Date(Date.now() - 30 * 86400000);
  const [patients, doctors, pendingDoctors, records, appointments, openReports, newPatients, newDoctors, errors, files, prescriptions, clinics, pendingOrgs, storage] = await Promise.all([
    Patient.countDocuments(),
    Doctor.countDocuments(),
    Doctor.countDocuments({ 'verification.status': 'pending' }),
    MedicalRecord.countDocuments(),
    Appointment.countDocuments(),
    Report.countDocuments({ status: 'open' }),
    Patient.countDocuments({ createdAt: { $gte: since } }),
    Doctor.countDocuments({ createdAt: { $gte: since } }),
    ErrorLog.countDocuments({ createdAt: { $gte: new Date(Date.now() - 86400000) } }),
    Attachment.countDocuments(),
    Prescription.countDocuments(),
    Clinic.countDocuments(),
    Clinic.countDocuments({ 'verification.status': 'pending' }),
    mongoose.connection.db.stats().catch(() => null),
  ]);
  res.status(200).json({
    patients, doctors, pendingDoctors, records, appointments, openReports, newPatients, newDoctors, errorsToday: errors, files, prescriptions, clinics, pendingOrgs,
    storageMB: storage ? Math.round(((storage.dataSize || 0) + (storage.indexSize || 0)) / 1048576) : null,
  });
});

// ?status=pending|unverified|verified|rejected|all
const listDoctors = expressAsyncHandler(async (req, res) => {
  const status = String(req.query.status || 'pending');
  const q = String(req.query.q || '').trim();
  const filter = {};
  if (status === 'verified') filter.$or = [{ 'verification.status': 'verified' }, { 'verification.status': { $exists: false } }];
  else if (status !== 'all') filter['verification.status'] = status;
  if (q) {
    const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$and = [{ $or: [{ firstName: rx }, { lastName: rx }, { email: rx }, { hospital: rx }, { 'verification.pmdcNumber': rx }, ...(/^\d+$/.test(q) ? [{ doctorCNIC: Number(q) }] : [])] }];
  }
  const doctors = await Doctor.find(filter).sort({ 'verification.submittedAt': -1, createdAt: -1 }).limit(200);
  res.status(200).json(doctors);
});

const doctorDocument = expressAsyncHandler(async (req, res) => {
  const doctor = await Doctor.findOne({ doctorCNIC: Number(req.params.doctorCNIC) });
  const doc = doctor?.verification?.document;
  if (!doc?.gridId) return res.status(404).json({ error: 'No document uploaded' });
  res.set({ 'Content-Type': doc.mime, 'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(doc.name)}`, 'Cache-Control': 'private, no-store' });
  openFileStream(doc.gridId).on('error', () => !res.headersSent && res.status(404).end()).pipe(res);
});

// { decision: 'verified' | 'rejected', note }
const reviewDoctor = expressAsyncHandler(async (req, res) => {
  const { decision, note } = req.body || {};
  if (!['verified', 'rejected'].includes(decision)) return res.status(400).json({ error: 'Choose verify or reject' });
  if (decision === 'rejected' && !String(note || '').trim()) return res.status(400).json({ error: 'Tell the doctor why, so they can fix it' });
  const doctor = await Doctor.findOne({ doctorCNIC: Number(req.params.doctorCNIC) });
  if (!doctor) return res.status(404).json({ error: 'Doctor not found' });
  doctor.verification = { ...(doctor.verification?.toObject?.() || {}), status: decision, note: String(note || '').trim(), reviewedAt: new Date() };
  await doctor.save();
  forgetAccountStatus('doctor', doctor.doctorCNIC);
  const verified = decision === 'verified';
  notify('doctor', doctor.doctorCNIC, {
    type: 'verification',
    title: verified ? 'You are verified' : 'Verification needs attention',
    body: verified ? 'Your PMDC registration was verified. Patients can now find you and add you to their care team.' : `We could not verify your PMDC registration: ${doctor.verification.note}`,
    link: `/doctor/profile/${doctor.doctorCNIC}`,
  });
  if (mailEnabled() && doctor.email) {
    sendMail({
      to: doctor.email,
      ...brandedEmail({
        subject: verified ? 'Your PakMedRecord doctor account is verified' : 'Action needed: PakMedRecord verification',
        name: `Dr. ${doctor.firstName}`,
        paragraphs: verified
          ? ['Your PMDC registration has been verified. Patients can now find you in the doctor directory and add you to their care team.']
          : ['We could not verify your PMDC registration yet.', `Reason: ${doctor.verification.note}`, 'You can upload a clearer document from your profile.'],
        button: { label: 'Open PakMedRecord', link: `${APP_URL()}/doctor/signin` },
      }),
    }).catch((err) => console.error('Verification email failed:', err.message));
  }
  res.status(200).json({ message: verified ? 'Doctor verified' : 'Doctor rejected', doctor });
});

// Search people by name, email or CNIC
const users = expressAsyncHandler(async (req, res) => {
  const role = req.query.role === 'doctor' ? 'doctor' : 'patient';
  const q = String(req.query.q || '').trim();
  const Model = role === 'doctor' ? Doctor : Patient;
  const key = role === 'doctor' ? 'doctorCNIC' : 'patientCNIC';
  const filter = {};
  if (q) {
    const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [{ firstName: rx }, { lastName: rx }, { email: rx }, ...(/^\d{3,13}$/.test(q.replace(/-/g, '')) ? [{ [key]: Number(q.replace(/-/g, '')) }] : [])];
  }
  const list = await Model.find(filter)
    .select(`${key} firstName lastName email hospital disabled disabledReason emailVerified createdAt guardianCNIC verification.status specialization`)
    .sort({ createdAt: -1 }).limit(100);
  res.status(200).json(list);
});

// { disabled: true|false, reason }
const setDisabled = expressAsyncHandler(async (req, res) => {
  const role = req.params.role;
  const Model = role === 'doctor' ? Doctor : role === 'patient' ? Patient : null;
  if (!Model) return res.status(400).json({ error: 'Unknown role' });
  const key = role === 'doctor' ? 'doctorCNIC' : 'patientCNIC';
  const user = await Model.findOne({ [key]: Number(req.params.cnic) });
  if (!user) return res.status(404).json({ error: 'Account not found' });
  user.disabled = Boolean(req.body?.disabled);
  user.disabledReason = user.disabled ? String(req.body?.reason || '').trim().slice(0, 300) : undefined;
  await user.save();
  forgetAccountStatus(role, user[key]);
  res.status(200).json({ message: user.disabled ? 'Account suspended' : 'Account restored', user });
});

const listReports = expressAsyncHandler(async (req, res) => {
  const status = ['open', 'resolved', 'dismissed'].includes(req.query.status) ? req.query.status : 'open';
  const reports = await Report.find({ status }).sort({ createdAt: -1 }).limit(200).lean();
  const doctorCnics = reports.filter((r) => r.target.role === 'doctor').map((r) => r.target.cnic);
  const patientCnics = reports.filter((r) => r.target.role === 'patient').map((r) => r.target.cnic);
  const [doctors, patients] = await Promise.all([
    Doctor.find({ doctorCNIC: { $in: doctorCnics } }).select('doctorCNIC firstName lastName disabled').lean(),
    Patient.find({ patientCNIC: { $in: patientCnics } }).select('patientCNIC firstName lastName disabled').lean(),
  ]);
  const name = (r) => {
    const p = r.target.role === 'doctor' ? doctors.find((d) => d.doctorCNIC === r.target.cnic) : patients.find((x) => x.patientCNIC === r.target.cnic);
    return p ? { name: `${r.target.role === 'doctor' ? 'Dr. ' : ''}${p.firstName} ${p.lastName}`, disabled: Boolean(p.disabled) } : { name: 'Deleted account', disabled: false };
  };
  res.status(200).json(reports.map((r) => ({ ...r, targetInfo: name(r) })));
});

const resolveReport = expressAsyncHandler(async (req, res) => {
  const { status, note } = req.body || {};
  if (!['resolved', 'dismissed'].includes(status)) return res.status(400).json({ error: 'Choose resolved or dismissed' });
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: 'Report not found' });
  const report = await Report.findByIdAndUpdate(req.params.id, { status, adminNote: String(note || '').slice(0, 500), resolvedAt: new Date() }, { new: true });
  if (!report) return res.status(404).json({ error: 'Report not found' });
  res.status(200).json({ message: 'Report updated', report });
});

const errors = expressAsyncHandler(async (req, res) => {
  res.status(200).json(await ErrorLog.find().sort({ createdAt: -1 }).limit(100));
});

// ---------- partners (labs and pharmacies) ----------

const listPartners = expressAsyncHandler(async (req, res) => {
  res.status(200).json(await Partner.find().sort({ createdAt: -1 }));
});

// The API key is shown once; only its hash is stored
const createPartner = expressAsyncHandler(async (req, res) => {
  const name = String(req.body?.name || '').trim();
  const type = req.body?.type;
  if (!name || !['lab', 'pharmacy'].includes(type)) return res.status(400).json({ error: 'Name and type (lab or pharmacy) are required' });
  const key = `pmr_${type}_${crypto.randomBytes(24).toString('base64url')}`;
  const partner = await Partner.create({ name, type, keyPrefix: key.slice(0, 12), keyHash: hashToken(key) });
  res.status(201).json({ partner, apiKey: key });
});

const updatePartner = expressAsyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: 'Partner not found' });
  const partner = await Partner.findByIdAndUpdate(req.params.id, { active: Boolean(req.body?.active) }, { new: true });
  if (!partner) return res.status(404).json({ error: 'Partner not found' });
  res.status(200).json({ partner });
});

// ---------- hospitals / clinics (organizations) ----------

// GET /admin/orgs?status=pending|unverified|verified|rejected|all&q=
const listOrgs = expressAsyncHandler(async (req, res) => {
  const status = String(req.query.status || 'pending');
  const filter = status === 'all' ? {} : { 'verification.status': status };
  const q = String(req.query.q || '').trim();
  if (q) {
    const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [{ name: rx }, { city: rx }, { registrationNo: rx }, { email: rx }];
  }
  const orgs = await Clinic.find(filter).sort({ 'verification.submittedAt': -1, createdAt: -1 }).limit(200);
  const ids = orgs.map((o) => o._id);
  const [branches, doctors, admins] = await Promise.all([
    Facility.aggregate([{ $match: { orgId: { $in: ids } } }, { $group: { _id: '$orgId', n: { $sum: 1 } } }]),
    Membership.aggregate([{ $match: { orgId: { $in: ids }, status: 'active' } }, { $group: { _id: '$orgId', n: { $sum: 1 } } }]),
    Staff.find({ clinicId: { $in: ids }, role: 'org_admin' }).select('clinicId name email').lean(),
  ]);
  const count = (arr, id) => arr.find((x) => String(x._id) === String(id))?.n || 0;
  res.status(200).json(orgs.map((o) => ({
    ...o.toJSON(), branches: count(branches, o._id), doctors: count(doctors, o._id),
    admins: admins.filter((a) => String(a.clinicId) === String(o._id)).map((a) => ({ name: a.name, email: a.email })),
  })));
});

const orgDocument = expressAsyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.orgId)) return res.status(404).json({ error: 'Not found' });
  const org = await Clinic.findById(req.params.orgId);
  const doc = org?.verification?.document;
  if (!doc?.gridId) return res.status(404).json({ error: 'No document uploaded' });
  res.set({ 'Content-Type': doc.mime, 'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(doc.name)}`, 'Cache-Control': 'private, no-store' });
  openFileStream(doc.gridId).on('error', () => !res.headersSent && res.status(404).end()).pipe(res);
});

// POST /admin/orgs/:orgId/review { decision: 'verified'|'rejected', note } or { suspended: true|false }
const reviewOrg = expressAsyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.orgId)) return res.status(404).json({ error: 'Not found' });
  const org = await Clinic.findById(req.params.orgId);
  if (!org) return res.status(404).json({ error: 'Not found' });
  const { decision, note, suspended } = req.body || {};
  if (typeof suspended === 'boolean') {
    org.suspended = suspended;
    await org.save();
    return res.status(200).json({ message: suspended ? 'Organization suspended' : 'Organization restored', org });
  }
  if (!['verified', 'rejected'].includes(decision)) return res.status(400).json({ error: 'Choose verify or reject' });
  if (decision === 'rejected' && !String(note || '').trim()) return res.status(400).json({ error: 'Tell them why, so they can fix it' });
  org.verification = { ...(org.verification?.toObject?.() || {}), status: decision, note: String(note || '').trim(), reviewedAt: new Date() };
  await org.save();
  const verified = decision === 'verified';
  const recipients = [org.email, ...(await Staff.find({ clinicId: org._id, role: 'org_admin' }).select('email').lean()).map((s) => s.email)].filter(Boolean);
  const adminDoctors = await Membership.find({ orgId: org._id, status: 'active', roles: 'org_admin' }).select('doctorCNIC').lean();
  adminDoctors.forEach((m) => notify('doctor', m.doctorCNIC, {
    type: 'verification', title: verified ? `${org.name} is verified` : `${org.name}: verification needs attention`,
    body: verified ? 'Patients can now find it and book its doctors.' : `Reason: ${org.verification.note}`, link: `/clinic/${m.doctorCNIC}`,
  }));
  if (mailEnabled()) {
    for (const to of [...new Set(recipients)]) {
      sendMail({
        to,
        ...brandedEmail({
          subject: verified ? `${org.name} is verified on PakMedRecord` : `Action needed: ${org.name} verification`,
          name: org.name,
          paragraphs: verified
            ? ['Your registration has been verified. Your hospital, its branches and its doctors are now visible to patients, who can book appointments with them.']
            : ['We could not verify your registration yet.', `Reason: ${org.verification.note}`, 'Sign in and upload a clearer certificate from Settings.'],
          button: { label: 'Open PakMedRecord', link: `${APP_URL()}/desk/signin` },
        }),
      }).catch((err) => console.error('Org verification email failed:', err.message));
    }
  }
  res.status(200).json({ message: verified ? 'Organization verified' : 'Organization rejected', org });
});

module.exports = {
  listOrgs, orgDocument, reviewOrg,
  signin, me, stats, listDoctors, doctorDocument, reviewDoctor, users, setDisabled, listReports, resolveReport, errors,
  listPartners, createPartner, updatePartner,
};
