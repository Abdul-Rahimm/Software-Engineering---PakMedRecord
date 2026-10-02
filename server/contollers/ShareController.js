// Patient-controlled access without accounts: time-limited share links and the emergency QR page.

const crypto = require('crypto');
const mongoose = require('mongoose');
const expressAsyncHandler = require('express-async-handler');
const ShareLink = require('../models/ShareLinkModel');
const Patient = require('../models/PatientModel');
const Doctor = require('../models/DoctorModel');
const MedicalRecord = require('../models/RecordModel');
const Vital = require('../models/VitalModel');
const Attachment = require('../models/AttachmentModel');
const { hashToken } = require('../lib/accounts');
const { logAccess } = require('../lib/accessLog');
const { openFileStream } = require('../lib/files');
const { ageYears } = require('../lib/dates');

const MAX_HOURS = 24 * 7;

// ---------- share links (patient side) ----------

const list = expressAsyncHandler(async (req, res) => {
  const links = await ShareLink.find({ patientCNIC: req.user.cnic }).sort({ createdAt: -1 }).limit(50);
  res.status(200).json(links);
});

// { label, hours, includeProfile, includeVitals, recordIds? } -> the raw token is returned once
const create = expressAsyncHandler(async (req, res) => {
  const hours = Number(req.body?.hours) || 24;
  if (hours < 1 || hours > MAX_HOURS) return res.status(400).json({ error: 'Choose between 1 hour and 7 days' });
  const recordIds = (Array.isArray(req.body?.recordIds) ? req.body.recordIds : []).filter((id) => mongoose.isValidObjectId(id)).slice(0, 100);
  if (recordIds.length) {
    const owned = await MedicalRecord.countDocuments({ _id: { $in: recordIds }, patientCNIC: req.user.cnic });
    if (owned !== recordIds.length) return res.status(400).json({ error: 'Some records are not yours' });
  }
  const active = await ShareLink.countDocuments({ patientCNIC: req.user.cnic, revokedAt: null, expiresAt: { $gt: new Date() } });
  if (active >= 20) return res.status(400).json({ error: 'You have 20 active links. Revoke some first.' });
  const token = crypto.randomBytes(24).toString('base64url');
  const link = await ShareLink.create({
    tokenHash: hashToken(token),
    patientCNIC: req.user.cnic,
    label: String(req.body?.label || '').trim().slice(0, 80) || 'Shared record',
    includeProfile: req.body?.includeProfile !== false,
    includeVitals: req.body?.includeVitals !== false,
    recordIds,
    expiresAt: new Date(Date.now() + hours * 3600 * 1000),
  });
  res.status(201).json({ link, token });
});

const revoke = expressAsyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: 'Link not found' });
  const link = await ShareLink.findOneAndUpdate({ _id: req.params.id, patientCNIC: req.user.cnic }, { revokedAt: new Date() }, { new: true });
  if (!link) return res.status(404).json({ error: 'Link not found' });
  res.status(200).json({ message: 'Link revoked', link });
});

// ---------- share links (public side) ----------

const findLink = async (token, res) => {
  const link = await ShareLink.findOne({ tokenHash: hashToken(String(token || '')) });
  if (!link || link.revokedAt || link.expiresAt < new Date()) {
    res.status(410).json({ error: 'This link has expired or was revoked by the patient.' });
    return null;
  }
  return link;
};

const profileView = (p) => ({
  name: `${p.firstName} ${p.lastName}`, gender: p.gender, age: ageYears(p.dateOfBirth), bloodGroup: p.bloodGroup,
  allergies: p.allergies, chronicConditions: p.chronicConditions, medications: (p.medications || []).map((m) => ({ name: m.name, dose: m.dose, frequency: m.frequency })),
  familyHistory: p.familyHistory, vaccinations: p.vaccinations, heightCm: p.heightCm, weightKg: p.weightKg,
});

const viewShare = expressAsyncHandler(async (req, res) => {
  const link = await findLink(req.params.token, res);
  if (!link) return;
  const patient = await Patient.findOne({ patientCNIC: link.patientCNIC }).lean();
  if (!patient) return res.status(410).json({ error: 'This record no longer exists.' });
  const recordFilter = { patientCNIC: link.patientCNIC, ...(link.recordIds.length && { _id: { $in: link.recordIds } }) };
  const [records, vitals] = await Promise.all([
    MedicalRecord.find(recordFilter).sort({ createdAt: -1 }).populate('attachments', 'name mime size ocr.summary ocr.text ocr.status').lean(),
    link.includeVitals ? Vital.find({ patientCNIC: link.patientCNIC }).sort({ recordedAt: -1 }).limit(60).lean() : [],
  ]);
  const doctors = await Doctor.find({ doctorCNIC: { $in: [...new Set(records.map((r) => r.doctorCNIC).filter(Boolean))] } }).select('doctorCNIC firstName lastName hospital specialization').lean();
  link.views += 1;
  link.lastViewedAt = new Date();
  await link.save();
  logAccess(link.patientCNIC, { role: 'share', id: String(link._id), name: link.label }, 'Opened your shared link', req.ip);
  res.status(200).json({
    label: link.label,
    expiresAt: link.expiresAt,
    patient: link.includeProfile ? profileView(patient) : { name: `${patient.firstName} ${patient.lastName}` },
    records: records.map((r) => {
      const d = doctors.find((x) => x.doctorCNIC === r.doctorCNIC);
      return {
        _id: r._id, title: r.title, category: r.category, recordData: r.recordData, createdAt: r.createdAt, source: r.source,
        author: r.partner?.name || (d ? `Dr. ${d.firstName} ${d.lastName}${d.hospital ? `, ${d.hospital}` : ''}` : 'Unknown'),
        attachments: (r.attachments || []).map((a) => ({ _id: a._id, name: a.name, mime: a.mime, size: a.size, summary: a.ocr?.summary, text: a.ocr?.text })),
      };
    }),
    vitals,
  });
});

const shareFile = expressAsyncHandler(async (req, res) => {
  const link = await findLink(req.params.token, res);
  if (!link) return;
  if (!mongoose.isValidObjectId(req.params.fileId)) return res.status(404).json({ error: 'File not found' });
  const att = await Attachment.findOne({ _id: req.params.fileId, patientCNIC: link.patientCNIC });
  const inShared = att && (await MedicalRecord.exists({ patientCNIC: link.patientCNIC, attachments: att._id, ...(link.recordIds.length && { _id: { $in: link.recordIds } }) }));
  if (!inShared) return res.status(404).json({ error: 'File not found' });
  res.set({ 'Content-Type': att.mime, 'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(att.name)}`, 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' });
  openFileStream(att.gridId).on('error', () => !res.headersSent && res.status(404).end()).pipe(res);
});

// ---------- emergency QR ----------

// PUT /share/emergency { enabled } -> creates the token the first time; { regenerate: true } replaces it
const setEmergency = expressAsyncHandler(async (req, res) => {
  const patient = await Patient.findOne({ patientCNIC: req.user.cnic });
  const { enabled, regenerate } = req.body || {};
  if (typeof enabled === 'boolean') patient.emergencyAccess.enabled = enabled;
  if (!patient.emergencyAccess.token || regenerate) patient.emergencyAccess.token = crypto.randomBytes(16).toString('base64url');
  await patient.save();
  res.status(200).json({ emergencyAccess: patient.emergencyAccess });
});

const getEmergencySettings = expressAsyncHandler(async (req, res) => {
  const patient = await Patient.findOne({ patientCNIC: req.user.cnic }).select('emergencyAccess');
  res.status(200).json({ emergencyAccess: patient?.emergencyAccess || { enabled: false } });
});

// The page paramedics see after scanning the card: only what matters in an emergency
const viewEmergency = expressAsyncHandler(async (req, res) => {
  const patient = await Patient.findOne({ 'emergencyAccess.token': String(req.params.token), 'emergencyAccess.enabled': true }).lean();
  if (!patient) return res.status(404).json({ error: 'This emergency card is not active.' });
  logAccess(patient.patientCNIC, { role: 'public', name: 'Emergency QR scan' }, 'Emergency card scanned', req.ip);
  res.status(200).json({
    name: `${patient.firstName} ${patient.lastName}`,
    gender: patient.gender,
    age: ageYears(patient.dateOfBirth),
    bloodGroup: patient.bloodGroup || null,
    allergies: patient.allergies || [],
    chronicConditions: patient.chronicConditions || [],
    medications: (patient.medications || []).map((m) => ({ name: m.name, dose: m.dose, frequency: m.frequency })),
    emergencyContact: patient.emergencyContact?.phone ? patient.emergencyContact : null,
    updatedAt: patient.updatedAt,
  });
});

module.exports = { list, create, revoke, viewShare, shareFile, setEmergency, getEmergencySettings, viewEmergency };
