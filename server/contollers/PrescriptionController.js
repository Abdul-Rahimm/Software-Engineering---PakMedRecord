// E-prescriptions: written by the doctor, added to the patient's record and medicine list,
// verifiable by pharmacies through the QR code.

const crypto = require('crypto');
const expressAsyncHandler = require('express-async-handler');
const Prescription = require('../models/PrescriptionModel');
const MedicalRecord = require('../models/RecordModel');
const Patient = require('../models/PatientModel');
const Doctor = require('../models/DoctorModel');
const Affiliation = require('../models/AffiliationModel');
const { notify } = require('../lib/notify');
const { generateJSON } = require('../ai/assistant');
const { ageYears } = require('../lib/dates');

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const newCode = () => Array.from(crypto.randomBytes(10), (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('');

// "Twice daily" -> ['09:00', '21:00'] for the medicine tracker
const timesFor = (frequency) => {
  const f = String(frequency || '').toLowerCase();
  if (/(four|4|qid|qds)/.test(f)) return ['08:00', '12:00', '16:00', '20:00'];
  if (/(three|thrice|3|tid|tds)/.test(f)) return ['08:00', '14:00', '20:00'];
  if (/(two|twice|2|bid|bd)/.test(f)) return ['09:00', '21:00'];
  if (/(night|bedtime|hs)/.test(f)) return ['22:00'];
  if (/(once|daily|1|od|morning)/.test(f)) return ['09:00'];
  return [];
};

const cleanItems = (items) =>
  (Array.isArray(items) ? items : [])
    .filter((i) => i && String(i.name || '').trim())
    .slice(0, 20)
    .map((i) => ({
      name: String(i.name).trim().slice(0, 120),
      dose: String(i.dose || '').trim().slice(0, 60),
      frequency: String(i.frequency || '').trim().slice(0, 60),
      durationDays: i.durationDays === '' || i.durationDays == null ? undefined : Math.max(0, Math.min(365, Number(i.durationDays) || 0)),
      instructions: String(i.instructions || '').trim().slice(0, 200),
    }));

const describeItem = (i) => [i.name, i.dose, i.frequency, i.durationDays ? `for ${i.durationDays} days` : '', i.instructions ? `(${i.instructions})` : ''].filter(Boolean).join(' ');

// Allergy and duplicate checks that never need the AI; AI adds drug-drug interactions when available
const checkSafety = async (patient, items) => {
  const warnings = [];
  const norm = (s) => String(s || '').toLowerCase().trim();
  for (const item of items) {
    const name = norm(item.name);
    for (const allergy of patient.allergies || []) {
      const a = norm(allergy);
      const first = name.split(' ')[0];
      if (a.length >= 3 && (name.includes(a) || (first.length >= 4 && a.includes(first)))) {
        warnings.push({ severity: 'high', medicine: item.name, message: `Patient is allergic to "${allergy}".`, source: 'allergy' });
      }
    }
    const current = (patient.medications || []).find((m) => norm(m.name) === name);
    if (current) warnings.push({ severity: 'low', medicine: item.name, message: `Already on ${current.name}${current.dose ? ` ${current.dose}` : ''}; this will update the dose.`, source: 'duplicate' });
  }
  let ai = null;
  try {
    ai = await generateJSON({
      system: 'You are a clinical pharmacology checker for doctors in Pakistan. Find clinically significant drug-drug interactions, drug-allergy cross-reactions (e.g. penicillin and amoxicillin) and drug-condition contraindications. Be conservative: only report well-established issues. Return {"warnings":[{"severity":"high|moderate|low","medicine":"name","message":"one sentence with the reason and what to consider"}]}. Return {"warnings":[]} if none.',
      prompt: [
        `New prescription: ${items.map(describeItem).join('; ')}`,
        `Current medicines: ${(patient.medications || []).map((m) => `${m.name} ${m.dose || ''}`).join(', ') || 'none recorded'}`,
        `Allergies: ${(patient.allergies || []).join(', ') || 'none recorded'}`,
        `Conditions: ${(patient.chronicConditions || []).join(', ') || 'none recorded'}`,
        `Age: ${ageYears(patient.dateOfBirth) ?? 'unknown'}, sex: ${patient.gender}`,
      ].join('\n'),
    });
  } catch (err) {
    console.error('Interaction check failed:', err.message);
  }
  const aiWarnings = (ai?.warnings || [])
    .filter((w) => w && w.message)
    .slice(0, 10)
    .map((w) => ({ severity: ['high', 'moderate', 'low'].includes(w.severity) ? w.severity : 'moderate', medicine: String(w.medicine || '').slice(0, 120), message: String(w.message).slice(0, 300), source: 'ai' }));
  return { warnings: [...warnings, ...aiWarnings], aiChecked: Boolean(ai) };
};

const loadForDoctor = async (req, res, patientCNIC) => {
  const [patient, affiliation] = await Promise.all([
    Patient.findOne({ patientCNIC }),
    Affiliation.findOne({ patientCNIC, doctorCNIC: req.user.cnic }),
  ]);
  if (!patient) {
    res.status(404).json({ error: 'Patient not found' });
    return null;
  }
  if (!affiliation) {
    res.status(403).json({ error: 'Patient and doctor are not affiliated' });
    return null;
  }
  return patient;
};

// POST /prescriptions/check { patientCNIC, items }
const check = expressAsyncHandler(async (req, res) => {
  const patientCNIC = Number(req.body?.patientCNIC);
  const items = cleanItems(req.body?.items);
  if (!items.length) return res.status(400).json({ error: 'Add at least one medicine' });
  const patient = await loadForDoctor(req, res, patientCNIC);
  if (!patient) return;
  res.status(200).json(await checkSafety(patient, items));
});

// POST /prescriptions { patientCNIC, diagnosis, items, notes }
const create = expressAsyncHandler(async (req, res) => {
  const patientCNIC = Number(req.body?.patientCNIC);
  const items = cleanItems(req.body?.items);
  if (!items.length) return res.status(400).json({ error: 'Add at least one medicine' });
  const patient = await loadForDoctor(req, res, patientCNIC);
  if (!patient) return;
  const doctor = await Doctor.findOne({ doctorCNIC: req.user.cnic });
  const diagnosis = String(req.body?.diagnosis || '').trim().slice(0, 300);
  const notes = String(req.body?.notes || '').trim().slice(0, 600);

  let code = newCode();
  while (await Prescription.exists({ code })) code = newCode();

  const record = await MedicalRecord.create({
    patientCNIC,
    doctorCNIC: req.user.cnic,
    title: diagnosis ? `Prescription: ${diagnosis}`.slice(0, 120) : 'Prescription',
    category: 'Prescription',
    recordData: [diagnosis && `Diagnosis: ${diagnosis}`, ...items.map((i, n) => `${n + 1}. ${describeItem(i)}`), notes && `Notes: ${notes}`, `Prescription code: ${code}`].filter(Boolean).join('\n'),
    source: 'doctor',
  });
  const prescription = await Prescription.create({ code, patientCNIC, doctorCNIC: req.user.cnic, diagnosis, items, notes, recordId: record._id });

  // Keep the patient's medicine list (and tracker) in step with the prescription
  const today = new Date();
  for (const item of items) {
    const meds = patient.medications || [];
    const idx = meds.findIndex((m) => m.name.toLowerCase() === item.name.toLowerCase());
    const endDate = item.durationDays ? new Date(today.getTime() + item.durationDays * 86400000) : undefined;
    const entry = {
      name: item.name, dose: item.dose, frequency: item.frequency, times: timesFor(item.frequency),
      startDate: today, endDate, refillDate: endDate, prescriptionCode: code,
    };
    if (idx >= 0) meds.set(idx, { ...meds[idx].toObject(), ...entry });
    else meds.push(entry);
  }
  await patient.save();

  notify('patient', patientCNIC, {
    type: 'prescription',
    title: 'New prescription',
    body: `Dr. ${doctor.firstName} ${doctor.lastName} prescribed ${items.map((i) => i.name).join(', ')}. Your medicine list was updated.`,
    link: `/meds/${patientCNIC}`,
  });
  res.status(201).json({ message: 'Prescription saved', prescription, record });
});

// GET /prescriptions/patient/:patientCNIC
const forPatient = expressAsyncHandler(async (req, res) => {
  const list = await Prescription.find({ patientCNIC: Number(req.params.patientCNIC) }).sort({ createdAt: -1 }).lean();
  const doctors = await Doctor.find({ doctorCNIC: { $in: [...new Set(list.map((p) => p.doctorCNIC))] } }).select('doctorCNIC firstName lastName hospital specialization verification').lean();
  res.status(200).json(list.map((p) => ({ ...p, doctor: doctors.find((d) => d.doctorCNIC === p.doctorCNIC) || null })));
});

// Doctor cancels their own prescription
const cancel = expressAsyncHandler(async (req, res) => {
  const p = await Prescription.findOne({ code: req.params.code, doctorCNIC: req.user.cnic });
  if (!p) return res.status(404).json({ error: 'Prescription not found' });
  if (p.status !== 'active') return res.status(409).json({ error: `This prescription is already ${p.status}` });
  p.status = 'cancelled';
  await p.save();
  res.status(200).json({ message: 'Prescription cancelled', prescription: p });
});

// Public QR verification: enough for a pharmacist to trust it, without exposing the patient's identity
const verifyPublic = expressAsyncHandler(async (req, res) => {
  const p = await Prescription.findOne({ code: String(req.params.code).toUpperCase() }).lean();
  if (!p) return res.status(404).json({ error: 'No prescription with this code' });
  const [doctor, patient] = await Promise.all([
    Doctor.findOne({ doctorCNIC: p.doctorCNIC }).lean(),
    Patient.findOne({ patientCNIC: p.patientCNIC }).select('firstName lastName gender dateOfBirth').lean(),
  ]);
  res.status(200).json({
    code: p.code,
    status: p.status,
    issuedAt: p.createdAt,
    dispensed: p.dispensed?.at ? p.dispensed : null,
    diagnosis: p.diagnosis,
    items: p.items,
    notes: p.notes,
    doctor: doctor ? {
      name: `Dr. ${doctor.firstName} ${doctor.lastName}`, specialization: doctor.specialization, hospital: doctor.hospital,
      verified: !doctor.verification?.status || doctor.verification.status === 'verified', pmdcNumber: doctor.verification?.pmdcNumber || null,
    } : null,
    patient: patient ? { initials: `${patient.firstName[0]}. ${patient.lastName[0]}.`, gender: patient.gender, age: ageYears(patient.dateOfBirth) } : null,
  });
});

module.exports = { check, create, forPatient, cancel, verifyPublic, timesFor };
