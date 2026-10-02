// Things every signed-in person can do with their own account:
// two-step sign-in, download all their data, delete the account.

const bcrypt = require('bcrypt');
const expressAsyncHandler = require('express-async-handler');
const { MODELS, findBySubject, newRecoveryCodes } = require('../lib/session');
const { generateSecret, verifyTotp, otpauthUrl } = require('../lib/totp');
const { forgetAccountStatus } = require('../middleware/auth');
const { deleteFile } = require('../lib/files');
const MedicalRecord = require('../models/RecordModel');
const TempRecord = require('../models/tempRecordModel');
const Appointment = require('../models/AppointmentModel');
const Vital = require('../models/VitalModel');
const Note = require('../models/NotesModel');
const Notification = require('../models/NotificationModel');
const ChatThread = require('../models/ChatThreadModel');
const Attachment = require('../models/AttachmentModel');
const Affiliation = require('../models/AffiliationModel');
const AccessLog = require('../models/AccessLogModel');
const Prescription = require('../models/PrescriptionModel');
const DoseLog = require('../models/DoseLogModel');
const ShareLink = require('../models/ShareLinkModel');
const Payment = require('../models/PaymentModel');
const Patient = require('../models/PatientModel');
const Clinic = require('../models/ClinicModel');

const subject = (user) => user.cnic ?? user.id;
const me = (req) => findBySubject(req.user.role, subject(req.user));

const noDependents = (req, res, next) => {
  if (req.user.guardian) return res.status(403).json({ error: 'Switch back to your own profile to change account security.' });
  next();
};

// ---------- two-step sign-in (authenticator app) ----------

const twoFactorStatus = expressAsyncHandler(async (req, res) => {
  const user = await me(req);
  res.status(200).json({ enabled: Boolean(user?.twoFactor?.enabled) });
});

const twoFactorSetup = expressAsyncHandler(async (req, res) => {
  const user = await me(req);
  if (user.twoFactor?.enabled) return res.status(409).json({ error: 'Two-step sign-in is already on' });
  const secret = generateSecret();
  user.twoFactor.pendingSecret = secret;
  await user.save();
  const label = user.email || String(subject(req.user));
  res.status(200).json({ secret, otpauthUrl: otpauthUrl(secret, label) });
});

const twoFactorEnable = expressAsyncHandler(async (req, res) => {
  const user = await me(req).select('+twoFactor.pendingSecret');
  if (!user.twoFactor?.pendingSecret) return res.status(400).json({ error: 'Start the setup again' });
  if (!verifyTotp(user.twoFactor.pendingSecret, req.body?.code)) {
    return res.status(400).json({ error: 'That code is not right. Make sure the time on your phone is correct.' });
  }
  const codes = newRecoveryCodes();
  user.twoFactor = {
    enabled: true,
    secret: user.twoFactor.pendingSecret,
    pendingSecret: undefined,
    recoveryHashes: await Promise.all(codes.map((c) => bcrypt.hash(c, 8))),
  };
  await user.save();
  res.status(200).json({ message: 'Two-step sign-in is on', recoveryCodes: codes });
});

const twoFactorDisable = expressAsyncHandler(async (req, res) => {
  const user = await me(req).select('+twoFactor.secret');
  if (!user.twoFactor?.enabled) return res.status(400).json({ error: 'Two-step sign-in is not on' });
  if (!verifyTotp(user.twoFactor.secret, req.body?.code)) return res.status(400).json({ error: 'Enter a current code from your authenticator app' });
  user.twoFactor = { enabled: false, secret: undefined, pendingSecret: undefined, recoveryHashes: [] };
  await user.save();
  res.status(200).json({ message: 'Two-step sign-in is off' });
});

// ---------- export ----------

const attachmentView = (a) => ({
  id: a._id, name: a.name, mime: a.mime, size: a.size, uploadedAt: a.createdAt,
  extractedText: a.ocr?.text, summary: a.ocr?.summary, labs: a.ocr?.labs,
});

const patientBundle = async (cnic) => {
  const [patient, records, submissions, appointments, vitals, notes, prescriptions, doses, accessLog, attachments, team, dependents] = await Promise.all([
    Patient.findOne({ patientCNIC: cnic }).lean(),
    MedicalRecord.find({ patientCNIC: cnic }).lean(),
    TempRecord.find({ patientCNIC: cnic }).lean(),
    Appointment.find({ patientCNIC: cnic }).lean(),
    Vital.find({ patientCNIC: cnic }).lean(),
    Note.find({ patientCNIC: cnic }).lean(),
    Prescription.find({ patientCNIC: cnic }).lean(),
    DoseLog.find({ patientCNIC: cnic }).lean(),
    AccessLog.find({ patientCNIC: cnic }).lean(),
    Attachment.find({ patientCNIC: cnic }).lean(),
    Affiliation.find({ patientCNIC: cnic }).lean(),
    Patient.find({ guardianCNIC: cnic }).select('patientCNIC firstName lastName relation').lean(),
  ]);
  if (patient) {
    delete patient.password;
    delete patient.twoFactor;
  }
  return {
    profile: patient, careTeam: team.flatMap((t) => t.doctorCNIC), records, submissions, appointments, vitals, notes,
    prescriptions, medicineDoses: doses, accessLog, documents: attachments.map(attachmentView), dependents,
  };
};

const exportData = expressAsyncHandler(async (req, res) => {
  const { role, cnic } = req.user;
  let data;
  if (role === 'patient') {
    data = await patientBundle(cnic);
  } else if (role === 'doctor') {
    const user = (await me(req)).toJSON();
    delete user.twoFactor;
    const [appointments, recordsWritten, prescriptions, clinic] = await Promise.all([
      Appointment.find({ doctorCNIC: cnic }).lean(),
      MedicalRecord.find({ doctorCNIC: cnic }).select('patientCNIC title category createdAt').lean(),
      Prescription.find({ doctorCNIC: cnic }).lean(),
      Clinic.findOne({ 'doctors.doctorCNIC': cnic }).lean(),
    ]);
    data = { profile: user, appointments, recordsWritten, prescriptions, clinic };
  } else {
    return res.status(400).json({ error: 'Export is available for doctor and patient accounts' });
  }
  res.set('Content-Disposition', `attachment; filename="pakmedrecord-${role}-${cnic}-${new Date().toISOString().slice(0, 10)}.json"`);
  res.status(200).json({ exportedAt: new Date(), format: 'PakMedRecord export v1', role, ...data });
});

// Patient's "who viewed my record" list, with the viewers' names
const accessLog = expressAsyncHandler(async (req, res) => {
  if (req.user.role !== 'patient') return res.status(400).json({ error: 'Only for patients' });
  const logs = await AccessLog.find({ patientCNIC: req.user.cnic }).sort({ lastAt: -1 }).limit(200).lean();
  const Doctor = MODELS.doctor.Model;
  const doctors = await Doctor.find({ doctorCNIC: { $in: [...new Set(logs.filter((l) => l.actor.role === 'doctor').map((l) => l.actor.cnic))] } }).select('doctorCNIC firstName lastName hospital').lean();
  res.status(200).json(logs.map((l) => {
    const d = l.actor.role === 'doctor' && doctors.find((x) => x.doctorCNIC === l.actor.cnic);
    return {
      _id: l._id, action: l.action, count: l.count, at: l.lastAt, role: l.actor.role,
      who: d ? `Dr. ${d.firstName} ${d.lastName}` : l.actor.name || { doctor: 'A doctor (account closed)', public: 'Emergency QR scan', share: 'Share link', partner: 'Partner' }[l.actor.role],
      where: d?.hospital || '',
    };
  }));
});

// ---------- delete ----------

const purgePatient = async (cnic) => {
  const files = await Attachment.find({ patientCNIC: cnic }).select('gridId').lean();
  await Promise.all(files.map((f) => deleteFile(f.gridId)));
  await Promise.all([
    Attachment.deleteMany({ patientCNIC: cnic }),
    MedicalRecord.deleteMany({ patientCNIC: cnic }),
    TempRecord.deleteMany({ patientCNIC: cnic }),
    Appointment.deleteMany({ patientCNIC: cnic }),
    Vital.deleteMany({ patientCNIC: cnic }),
    Note.deleteMany({ patientCNIC: cnic }),
    Notification.deleteMany({ role: 'patient', cnic }),
    ChatThread.deleteMany({ role: 'patient', cnic }),
    Affiliation.deleteMany({ patientCNIC: cnic }),
    AccessLog.deleteMany({ patientCNIC: cnic }),
    Prescription.deleteMany({ patientCNIC: cnic }),
    DoseLog.deleteMany({ patientCNIC: cnic }),
    ShareLink.deleteMany({ patientCNIC: cnic }),
    Payment.deleteMany({ patientCNIC: cnic }),
    Patient.deleteOne({ patientCNIC: cnic }),
  ]);
};

// Needs the password (or typing DELETE for Google-only accounts). Patients' dependents are deleted too.
const deleteAccount = expressAsyncHandler(async (req, res) => {
  if (req.user.guardian) return res.status(403).json({ error: 'Remove this profile from the Family page instead.' });
  const { role, cnic } = req.user;
  if (!['doctor', 'patient'].includes(role)) return res.status(400).json({ error: 'Not available for this account' });
  const user = await me(req);
  const { password, confirm } = req.body || {};
  const ok = user.password ? await bcrypt.compare(String(password || ''), user.password) : confirm === 'DELETE';
  if (!ok) return res.status(401).json({ error: user.password ? 'Password is not correct' : 'Type DELETE to confirm' });

  if (role === 'patient') {
    const dependents = await Patient.find({ guardianCNIC: cnic }).select('patientCNIC').lean();
    for (const d of dependents) await purgePatient(d.patientCNIC);
    await purgePatient(cnic);
  } else {
    // Records doctors wrote belong to the patients' histories and are kept
    await Promise.all([
      Affiliation.updateMany({ doctorCNIC: cnic }, { $pull: { doctorCNIC: cnic } }),
      Appointment.updateMany({ doctorCNIC: cnic, status: 'pending' }, { status: 'cancelled', cancelledBy: 'doctor', cancelReason: 'Doctor account closed' }),
      Notification.deleteMany({ role: 'doctor', cnic }),
      ChatThread.deleteMany({ role: 'doctor', cnic }),
      Clinic.updateMany({}, { $pull: { doctors: { doctorCNIC: cnic } } }),
    ]);
    if (user.verification?.document?.gridId) await deleteFile(user.verification.document.gridId);
    await MODELS.doctor.Model.deleteOne({ doctorCNIC: cnic });
    await Affiliation.deleteMany({ doctorCNIC: { $size: 0 } });
  }
  forgetAccountStatus(role, cnic);
  res.status(200).json({ message: 'Your account and data have been deleted.' });
});

module.exports = {
  accessLog, noDependents, twoFactorStatus, twoFactorSetup, twoFactorEnable, twoFactorDisable, exportData, deleteAccount, purgePatient, patientBundle,
};
