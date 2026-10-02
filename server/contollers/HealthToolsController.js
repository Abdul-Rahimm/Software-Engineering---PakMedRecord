// Medicine tracker, childhood vaccination schedule, lab trends and AI follow-up suggestions.

const expressAsyncHandler = require('express-async-handler');
const Patient = require('../models/PatientModel');
const DoseLog = require('../models/DoseLogModel');
const Attachment = require('../models/AttachmentModel');
const MedicalRecord = require('../models/RecordModel');
const Appointment = require('../models/AppointmentModel');
const Vital = require('../models/VitalModel');
const { scheduleFor, EPI_SCHEDULE } = require('../lib/epi');
const { pktDate, addDays, ageYears } = require('../lib/dates');
const { generateJSON } = require('../ai/assistant');
const { isTime } = require('../lib/validate');

const patientOf = async (req, res) => {
  const patient = await Patient.findOne({ patientCNIC: Number(req.params.patientCNIC) });
  if (!patient) res.status(404).json({ error: 'Patient not found' });
  return patient;
};

const ymd = (d) => (d ? new Date(d).toISOString().slice(0, 10) : null);

// A medicine is scheduled on a day if it has dose times and the day is inside its course
const activeOn = (m, day) => m.times?.length && (!m.startDate || ymd(m.startDate) <= day) && (!m.endDate || ymd(m.endDate) >= day);

// ---------- medicines ----------

// GET /meds/:patientCNIC?date=YYYY-MM-DD -> today's doses with taken/skipped state, refills due
const medsDay = expressAsyncHandler(async (req, res) => {
  const patient = await patientOf(req, res);
  if (!patient) return;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(String(req.query.date)) ? req.query.date : pktDate();
  const logs = await DoseLog.find({ patientCNIC: patient.patientCNIC, date }).lean();
  const doses = [];
  for (const m of patient.medications || []) {
    if (!activeOn(m, date)) continue;
    for (const time of m.times) {
      const log = logs.find((l) => l.med === m.name.toLowerCase() && l.time === time);
      doses.push({ med: m.name, dose: m.dose, time, status: log?.status || null });
    }
  }
  doses.sort((a, b) => a.time.localeCompare(b.time));
  const today = pktDate();
  const refills = (patient.medications || [])
    .filter((m) => m.refillDate && ymd(m.refillDate) <= addDays(today, 3))
    .map((m) => ({ med: m.name, refillDate: ymd(m.refillDate), overdue: ymd(m.refillDate) < today }));
  res.status(200).json({ date, doses, refills, medications: patient.medications });
});

// POST /meds/:patientCNIC/dose { med, date, time, status: 'taken'|'skipped'|null }
const logDose = expressAsyncHandler(async (req, res) => {
  const patient = await patientOf(req, res);
  if (!patient) return;
  const { med, date, time, status } = req.body || {};
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date)) || !isTime(time)) return res.status(400).json({ error: 'Date and time are required' });
  if (date > addDays(pktDate(), 1)) return res.status(400).json({ error: "You can't log future doses" });
  const m = (patient.medications || []).find((x) => x.name.toLowerCase() === String(med || '').toLowerCase());
  if (!m) return res.status(404).json({ error: 'Medicine not found in your list' });
  const key = { patientCNIC: patient.patientCNIC, med: m.name.toLowerCase(), date, time };
  if (!status) await DoseLog.deleteOne(key);
  else if (['taken', 'skipped'].includes(status)) await DoseLog.updateOne(key, { $set: { status } }, { upsert: true });
  else return res.status(400).json({ error: 'Unknown status' });
  res.status(200).json({ message: 'Saved' });
});

// GET /meds/:patientCNIC/adherence?days=30 -> share of scheduled doses marked taken
const adherence = expressAsyncHandler(async (req, res) => {
  const patient = await patientOf(req, res);
  if (!patient) return;
  const days = Math.min(90, Math.max(7, Number(req.query.days) || 30));
  const today = pktDate();
  const from = addDays(today, -(days - 1));
  const logs = await DoseLog.find({ patientCNIC: patient.patientCNIC, date: { $gte: from, $lte: today } }).lean();
  const perMed = [];
  const daily = [];
  let totalScheduled = 0;
  let totalTaken = 0;
  for (let i = 0; i < days; i++) {
    const day = addDays(from, i);
    let scheduled = 0;
    let taken = 0;
    for (const m of patient.medications || []) {
      if (!activeOn(m, day)) continue;
      // doses later today haven't happened yet
      const due = day === today ? m.times.filter((t) => t <= new Date().toLocaleTimeString('en-GB', { timeZone: 'Asia/Karachi', hour: '2-digit', minute: '2-digit' })) : m.times;
      scheduled += due.length;
      taken += logs.filter((l) => l.date === day && l.med === m.name.toLowerCase() && l.status === 'taken' && due.includes(l.time)).length;
    }
    daily.push({ date: day, scheduled, taken });
    totalScheduled += scheduled;
    totalTaken += taken;
  }
  for (const m of patient.medications || []) {
    if (!m.times?.length) continue;
    let scheduled = 0;
    for (let i = 0; i < days; i++) if (activeOn(m, addDays(from, i))) scheduled += m.times.length;
    const taken = logs.filter((l) => l.med === m.name.toLowerCase() && l.status === 'taken').length;
    perMed.push({ med: m.name, scheduled, taken, rate: scheduled ? Math.round((Math.min(taken, scheduled) / scheduled) * 100) : null });
  }
  res.status(200).json({ days, rate: totalScheduled ? Math.round((totalTaken / totalScheduled) * 100) : null, scheduled: totalScheduled, taken: totalTaken, perMed, daily });
});

// ---------- vaccinations ----------

const vaccines = expressAsyncHandler(async (req, res) => {
  const patient = await patientOf(req, res);
  if (!patient) return;
  res.status(200).json({ ...scheduleFor(patient), vaccinations: patient.vaccinations, dateOfBirth: patient.dateOfBirth });
});

// POST /vaccines/:patientCNIC { code, date } marks a schedule vaccine as given
const markVaccine = expressAsyncHandler(async (req, res) => {
  const patient = await patientOf(req, res);
  if (!patient) return;
  const v = EPI_SCHEDULE.find((x) => x.code === req.body?.code);
  if (!v) return res.status(400).json({ error: 'Unknown vaccine' });
  const date = req.body?.date ? new Date(req.body.date) : new Date();
  if (Number.isNaN(date.getTime()) || date > new Date(Date.now() + 86400000)) return res.status(400).json({ error: 'Enter a valid date' });
  patient.vaccinations = (patient.vaccinations || []).filter((x) => x.code !== v.code);
  patient.vaccinations.push({ name: v.name, code: v.code, date, dose: v.label });
  await patient.save();
  res.status(200).json({ ...scheduleFor(patient), vaccinations: patient.vaccinations });
});

const unmarkVaccine = expressAsyncHandler(async (req, res) => {
  const patient = await patientOf(req, res);
  if (!patient) return;
  patient.vaccinations = (patient.vaccinations || []).filter((x) => x.code !== req.params.code);
  await patient.save();
  res.status(200).json({ ...scheduleFor(patient), vaccinations: patient.vaccinations });
});

// ---------- lab trends ----------

// Same test written differently across labs ("HbA1c", "Hb A1C") is grouped together
const testKey = (name) => String(name || '').toLowerCase().replace(/\(.*?\)/g, '').replace(/[^a-z0-9]/g, '');

const labs = expressAsyncHandler(async (req, res) => {
  const patientCNIC = Number(req.params.patientCNIC);
  const docs = await Attachment.find({ patientCNIC, 'ocr.labs.0': { $exists: true } }).select('name ocr.labs ocr.documentDate ocr.title createdAt').lean();
  const series = {};
  for (const d of docs) {
    const date = d.ocr.documentDate || d.createdAt.toISOString().slice(0, 10);
    for (const l of d.ocr.labs) {
      if (typeof l.value !== 'number' || !Number.isFinite(l.value)) continue;
      const key = testKey(l.test);
      if (!key) continue;
      series[key] ||= { test: l.test, unit: l.unit || '', range: l.range || '', points: [] };
      series[key].points.push({ date, value: l.value, unit: l.unit || '', flag: l.flag || '', fileId: d._id, source: d.ocr.title || d.name });
      if (l.range) series[key].range = l.range;
    }
  }
  const out = Object.values(series)
    .map((s) => ({ ...s, points: s.points.sort((a, b) => a.date.localeCompare(b.date)) }))
    .sort((a, b) => b.points.length - a.points.length || a.test.localeCompare(b.test));
  res.status(200).json({ tests: out, documents: docs.length });
});

// ---------- follow-ups ("care gaps") ----------

const FOLLOWUP_SYSTEM = `You review a patient's medical record in PakMedRecord and list follow-ups that look due or overdue, for example a repeat test that a report or doctor asked for, a chronic condition without recent monitoring, or a worsening lab trend that has not been reviewed since.
Rules: base every item on the data given and cite the date it comes from; never diagnose or prescribe; phrase items as things to discuss with a doctor; prefer a few important items over many small ones; if nothing looks due, return an empty list.
Return {"items":[{"title":"short, max 8 words","detail":"one or two sentences citing the evidence and dates","priority":"high|medium|low"}]}.`;

const followups = expressAsyncHandler(async (req, res) => {
  const patient = await patientOf(req, res);
  if (!patient) return;
  const cnic = patient.patientCNIC;
  const today = pktDate();
  const items = [];

  // Rule-based reminders that need no AI
  for (const m of patient.medications || []) {
    if (m.refillDate && ymd(m.refillDate) <= addDays(today, 3)) {
      items.push({ title: `Refill ${m.name}`, detail: `Your supply runs out on ${ymd(m.refillDate)}. Ask your doctor or pharmacy for a refill.`, priority: ymd(m.refillDate) < today ? 'high' : 'medium', source: 'rule' });
    }
  }
  const epi = scheduleFor(patient);
  const overdue = epi.items.filter((v) => v.status === 'overdue');
  if (overdue.length) items.push({ title: `${overdue.length} vaccine${overdue.length > 1 ? 's' : ''} overdue`, detail: `${overdue.map((v) => v.name).join(', ')} (due ${overdue[0].dueDate}). Visit an EPI centre or your paediatrician.`, priority: 'high', source: 'rule' });
  const conditions = (patient.chronicConditions || []).join(' ').toLowerCase();
  const lastVital = async (type) => Vital.findOne({ patientCNIC: cnic, type }).sort({ recordedAt: -1 }).lean();
  if (/hypertension|blood pressure|bp/.test(conditions)) {
    const v = await lastVital('bloodPressure');
    if (!v || ymd(v.recordedAt) < addDays(today, -30)) items.push({ title: 'Check your blood pressure', detail: `You have hypertension and ${v ? `the last reading was on ${ymd(v.recordedAt)}` : 'no readings are logged yet'}. Log a reading in Vitals.`, priority: 'medium', source: 'rule' });
  }
  if (/diabet|sugar/.test(conditions)) {
    const v = await lastVital('glucose');
    if (!v || ymd(v.recordedAt) < addDays(today, -14)) items.push({ title: 'Check your blood glucose', detail: `You have diabetes and ${v ? `the last reading was on ${ymd(v.recordedAt)}` : 'no readings are logged yet'}.`, priority: 'medium', source: 'rule' });
  }

  // AI review of the record itself
  let aiUsed = false;
  try {
    const [records, docs, appts] = await Promise.all([
      MedicalRecord.find({ patientCNIC: cnic }).sort({ createdAt: -1 }).limit(30).lean(),
      Attachment.find({ patientCNIC: cnic, 'ocr.labs.0': { $exists: true } }).select('ocr.labs ocr.documentDate ocr.title createdAt').lean(),
      Appointment.find({ patientCNIC: cnic }).sort({ date: -1 }).limit(10).lean(),
    ]);
    if (records.length || docs.length) {
      const prompt = [
        `Today: ${today}. Patient: ${ageYears(patient.dateOfBirth) ?? 'unknown age'}, ${patient.gender}. Conditions: ${(patient.chronicConditions || []).join(', ') || 'none'}. Medicines: ${(patient.medications || []).map((m) => m.name).join(', ') || 'none'}.`,
        'Records (newest first):',
        ...records.map((r) => `- ${ymd(r.createdAt)} [${r.category}] ${r.title || ''}: ${String(r.recordData).slice(0, 400)}`),
        'Lab values:',
        ...docs.flatMap((d) => d.ocr.labs.map((l) => `- ${d.ocr.documentDate || ymd(d.createdAt)} ${l.test}: ${l.value} ${l.unit || ''} (ref ${l.range || 'n/a'})${l.flag ? ` flagged ${l.flag}` : ''}`)).slice(0, 80),
        'Appointments:',
        ...appts.map((a) => `- ${ymd(a.date)} ${a.status}${a.reason ? `: ${a.reason}` : ''}`),
      ].join('\n');
      const ai = await generateJSON({ system: FOLLOWUP_SYSTEM, prompt });
      if (ai) {
        aiUsed = true;
        for (const i of (ai.items || []).slice(0, 6)) {
          if (i?.title) items.push({ title: String(i.title).slice(0, 80), detail: String(i.detail || '').slice(0, 400), priority: ['high', 'medium', 'low'].includes(i.priority) ? i.priority : 'medium', source: 'ai' });
        }
      }
    }
  } catch (err) {
    console.error('Follow-up AI failed:', err.message);
  }
  const order = { high: 0, medium: 1, low: 2 };
  res.status(200).json({ items: items.sort((a, b) => order[a.priority] - order[b.priority]), aiUsed, checkedAt: new Date() });
});

module.exports = { medsDay, logDose, adherence, vaccines, markVaccine, unmarkVaccine, labs, followups };
