// Partner API for laboratories and pharmacies. Authenticated with an API key (X-API-Key header)
// issued by a PakMedRecord admin. See the Developers page for request examples.

const expressAsyncHandler = require('express-async-handler');
const Partner = require('../models/PartnerModel');
const Patient = require('../models/PatientModel');
const MedicalRecord = require('../models/RecordModel');
const Attachment = require('../models/AttachmentModel');
const Prescription = require('../models/PrescriptionModel');
const Doctor = require('../models/DoctorModel');
const { hashToken } = require('../lib/accounts');
const { saveFile } = require('../lib/files');
const { notify } = require('../lib/notify');
const { logAccess } = require('../lib/accessLog');
const { isCNIC } = require('../lib/validate');

const requirePartner = (type) => async (req, res, next) => {
  try {
    const key = String(req.get('x-api-key') || '');
    const partner = key && (await Partner.findOne({ keyHash: hashToken(key) }));
    if (!partner || !partner.active) return res.status(401).json({ error: 'Invalid or inactive API key' });
    if (partner.type !== type) return res.status(403).json({ error: `This key is for a ${partner.type}` });
    Partner.updateOne({ _id: partner._id }, { lastUsedAt: new Date() }).catch(() => {});
    req.partner = partner;
    next();
  } catch (err) {
    next(err);
  }
};

const sniff = (buf) => {
  if (buf.subarray(0, 5).toString('latin1') === '%PDF-') return 'application/pdf';
  if (buf[0] === 0x89 && buf.subarray(1, 4).toString('latin1') === 'PNG') return 'image/png';
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  return null;
};

// POST /partners/lab/results
// { patientCNIC, title, testDate, summary, results: [{ test, value, unit, range, flag }], file?: { name, base64 } }
const labResults = expressAsyncHandler(async (req, res) => {
  const b = req.body || {};
  if (!isCNIC(b.patientCNIC)) return res.status(400).json({ error: 'patientCNIC must be 13 digits' });
  const patient = await Patient.findOne({ patientCNIC: Number(b.patientCNIC) });
  if (!patient) return res.status(404).json({ error: 'No PakMedRecord patient with that CNIC' });
  const results = (Array.isArray(b.results) ? b.results : []).slice(0, 200).map((r) => ({
    test: String(r.test || '').trim().slice(0, 80),
    value: Number(r.value),
    unit: String(r.unit || '').slice(0, 20),
    range: String(r.range || '').slice(0, 40),
    flag: /^[HL]$/i.test(String(r.flag || '')) ? String(r.flag).toUpperCase() : '',
  })).filter((r) => r.test && Number.isFinite(r.value));
  if (!results.length && !b.file) return res.status(400).json({ error: 'Send results and/or a report file' });
  const title = String(b.title || 'Lab report').trim().slice(0, 120);
  const testDate = /^\d{4}-\d{2}-\d{2}$/.test(String(b.testDate || '')) ? b.testDate : new Date().toISOString().slice(0, 10);

  let buffer = null;
  let mime = null;
  if (b.file?.base64) {
    buffer = Buffer.from(String(b.file.base64), 'base64');
    if (buffer.length > 3 * 1024 * 1024) return res.status(413).json({ error: 'Report file must be under 3 MB' });
    mime = sniff(buffer);
    if (!mime) return res.status(415).json({ error: 'Report file must be a PDF, JPG or PNG' });
  }
  const table = results.length
    ? ['| Test | Result | Unit | Reference |', '|---|---|---|---|', ...results.map((r) => `| ${r.test} | ${r.value}${r.flag ? ` (${r.flag})` : ''} | ${r.unit} | ${r.range} |`)].join('\n')
    : '';
  const name = String(b.file?.name || `${title}.${mime === 'application/pdf' ? 'pdf' : 'jpg'}`).replace(/[\r\n"]/g, '').slice(0, 200);
  const gridId = buffer ? await saveFile(buffer, { name, mime, metadata: { patientCNIC: patient.patientCNIC, partner: String(req.partner._id) } }) : null;
  const att = gridId && await Attachment.create({
    gridId, patientCNIC: patient.patientCNIC, name, mime, size: buffer.length, linked: true,
    uploadedBy: { role: 'partner', partnerId: req.partner._id },
    ocr: { status: 'done', text: table || String(b.summary || ''), title, category: 'Lab result', documentDate: testDate, summary: String(b.summary || '').slice(0, 1000), labs: results },
  });
  // Without a file the values still need a home for lab trends: store them on a text-only attachment record
  const labsHolder = att || await Attachment.create({
    gridId: new (require('mongoose').Types.ObjectId)(), patientCNIC: patient.patientCNIC, name: `${title} (values)`, mime: 'text/markdown', size: 0, linked: true,
    uploadedBy: { role: 'partner', partnerId: req.partner._id },
    ocr: { status: 'done', text: table, title, category: 'Lab result', documentDate: testDate, summary: String(b.summary || '').slice(0, 1000), labs: results },
  });
  const record = await MedicalRecord.create({
    patientCNIC: patient.patientCNIC,
    title,
    category: 'Lab result',
    // readable lines in the timeline; the full table lives on the attached values
    recordData: [String(b.summary || '').trim(), ...results.map((r) => `${r.test}: ${r.value}${r.unit ? ` ${r.unit}` : ''}${r.flag ? ` (${r.flag === 'H' ? 'high' : 'low'})` : ''}${r.range ? ` · ref ${r.range}` : ''}`)].filter(Boolean).join('\n') || 'See attached report.',
    source: 'lab',
    partner: { id: req.partner._id, name: req.partner.name },
    attachments: att ? [att._id] : [],
  });
  logAccess(patient.patientCNIC, { role: 'partner', id: String(req.partner._id), name: req.partner.name }, 'Added lab results', req.ip);
  notify('patient', patient.patientCNIC, { type: 'record', title: 'New lab results', body: `${req.partner.name} added "${title}" to your records.`, link: `/record/getrecords/${patient.patientCNIC}` });
  res.status(201).json({ message: 'Results added to the patient record', recordId: record._id, values: results.length, valuesId: labsHolder._id });
});

// GET /partners/pharmacy/prescriptions/:code — what the pharmacist needs to dispense
const pharmacyGet = expressAsyncHandler(async (req, res) => {
  const p = await Prescription.findOne({ code: String(req.params.code).toUpperCase() }).lean();
  if (!p) return res.status(404).json({ error: 'No prescription with this code' });
  const [doctor, patient] = await Promise.all([
    Doctor.findOne({ doctorCNIC: p.doctorCNIC }).select('firstName lastName hospital verification').lean(),
    Patient.findOne({ patientCNIC: p.patientCNIC }).select('firstName lastName allergies').lean(),
  ]);
  logAccess(p.patientCNIC, { role: 'partner', id: String(req.partner._id), name: req.partner.name }, 'Pharmacy viewed a prescription', req.ip);
  res.status(200).json({
    code: p.code, status: p.status, issuedAt: p.createdAt, items: p.items, diagnosis: p.diagnosis, notes: p.notes, dispensed: p.dispensed,
    doctor: doctor && { name: `Dr. ${doctor.firstName} ${doctor.lastName}`, hospital: doctor.hospital, pmdcNumber: doctor.verification?.pmdcNumber || null },
    patient: patient && { name: `${patient.firstName} ${patient.lastName}`, allergies: patient.allergies || [] },
  });
});

// POST /partners/pharmacy/prescriptions/:code/dispense
const pharmacyDispense = expressAsyncHandler(async (req, res) => {
  const p = await Prescription.findOne({ code: String(req.params.code).toUpperCase() });
  if (!p) return res.status(404).json({ error: 'No prescription with this code' });
  if (p.status !== 'active') return res.status(409).json({ error: `This prescription is ${p.status}`, dispensed: p.dispensed });
  p.status = 'dispensed';
  p.dispensed = { by: req.partner.name, at: new Date() };
  await p.save();
  notify('patient', p.patientCNIC, { type: 'prescription', title: 'Prescription dispensed', body: `${req.partner.name} dispensed your prescription ${p.code}.`, link: `/meds/${p.patientCNIC}` });
  res.status(200).json({ message: 'Marked as dispensed', code: p.code, dispensed: p.dispensed });
});

module.exports = { requirePartner, labResults, pharmacyGet, pharmacyDispense };
