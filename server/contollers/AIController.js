const mongoose = require('mongoose');
const ChatThread = require('../models/ChatThreadModel');
const MedicalRecord = require('../models/RecordModel');
const Patient = require('../models/PatientModel');
const Doctor = require('../models/DoctorModel');
const Affiliation = require('../models/AffiliationModel');
const Vital = require('../models/VitalModel');
const { VITAL_TYPES } = require('../models/constants');
const { aiEnabled, chat, generate, EXPLAIN_SYSTEM, SUMMARY_SYSTEM, MODEL } = require('../ai/assistant');

const status = (req, res) => res.status(200).json({ enabled: aiEnabled(), model: aiEnabled() ? MODEL : null });

// Refuse AI endpoints cleanly when no credentials are configured
const requireAI = (req, res, next) =>
  aiEnabled()
    ? next()
    : res.status(503).json({ error: 'The AI assistant is not configured. Add ANTHROPIC_API_KEY to server/.env and restart the server.', code: 'AI_DISABLED' });

const day = (d) => (d ? new Date(d).toISOString().slice(0, 10) : 'unknown date');

// Text shown in the chat UI for stored API messages (tool calls and results are hidden)
const visibleText = (content) =>
  typeof content === 'string'
    ? content
    : (content || []).filter((b) => b.type === 'text').map((b) => b.text).join('');

const listThreads = async (req, res) => {
  const threads = await ChatThread.find({ role: req.user.role, cnic: req.user.cnic })
    .sort({ updatedAt: -1 }).limit(30).select('title updatedAt');
  res.status(200).json({ threads });
};

const getThread = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: 'Conversation not found' });
  const thread = await ChatThread.findOne({ _id: req.params.id, role: req.user.role, cnic: req.user.cnic });
  if (!thread) return res.status(404).json({ error: 'Conversation not found' });
  // Collapse API turns into chat bubbles: user text, and all assistant text between user messages
  const bubbles = [];
  for (const m of thread.messages) {
    if (m.role === 'user' && typeof m.content === 'string') {
      bubbles.push({ role: 'user', text: m.content });
    } else if (m.role === 'assistant') {
      const text = visibleText(m.content);
      const last = bubbles[bubbles.length - 1];
      if (!text) continue;
      // separate text from consecutive model turns (e.g. before and after a tool call)
      if (last?.role === 'assistant') last.text += last.text ? `\n\n${text}` : text;
      else bubbles.push({ role: 'assistant', text });
    }
  }
  res.status(200).json({ thread: { _id: thread._id, title: thread.title, messages: bubbles } });
};

const deleteThread = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: 'Conversation not found' });
  await ChatThread.deleteOne({ _id: req.params.id, role: req.user.role, cnic: req.user.cnic });
  res.status(200).json({ message: 'Conversation deleted' });
};

const postChat = async (req, res) => {
  const message = String(req.body?.message || '').trim();
  if (!message) return res.status(400).json({ error: 'Message is required' });
  if (message.length > 4000) return res.status(400).json({ error: 'Message is too long (4000 characters max)' });
  const threadId = req.body?.threadId && mongoose.isValidObjectId(req.body.threadId) ? req.body.threadId : null;
  await chat({ user: req.user, threadId, message, res });
};

// Plain-language explanation of one record (patient's own, or an affiliated doctor's patient)
const explainRecord = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.recordId)) return res.status(404).json({ error: 'Record not found' });
  const record = await MedicalRecord.findById(req.params.recordId);
  if (!record) return res.status(404).json({ error: 'Record not found' });
  const { role, cnic } = req.user;
  const allowed = role === 'patient'
    ? record.patientCNIC === cnic
    : Boolean(await Affiliation.findOne({ patientCNIC: record.patientCNIC, doctorCNIC: cnic }));
  if (!allowed) return res.status(403).json({ error: 'Not allowed' });

  const doctor = await Doctor.findOne({ doctorCNIC: record.doctorCNIC });
  const prompt = [
    `Record date: ${day(record.createdAt)}`,
    `Category: ${record.category || 'General'}`,
    record.title ? `Title: ${record.title}` : null,
    doctor ? `Written by: Dr. ${doctor.firstName} ${doctor.lastName} (${doctor.specialization || 'doctor'})` : null,
    '',
    '<record>',
    record.recordData,
    '</record>',
    '',
    'Explain this record to the patient.',
  ].filter((l) => l !== null).join('\n');

  await generate({ res, system: EXPLAIN_SYSTEM, prompt, effort: 'low' });
};

// Pre-consultation brief of a patient for an affiliated doctor
const summarizePatient = async (req, res) => {
  const patientCNIC = Number(req.params.patientCNIC);
  if (!(await Affiliation.findOne({ patientCNIC, doctorCNIC: req.user.cnic }))) {
    return res.status(403).json({ error: 'This patient has not added you to their care team.' });
  }
  const [patient, records, vitals] = await Promise.all([
    Patient.findOne({ patientCNIC }),
    MedicalRecord.find({ patientCNIC }).sort({ createdAt: 1 }),
    Vital.find({ patientCNIC }).sort({ recordedAt: -1 }).limit(40),
  ]);
  if (!patient) return res.status(404).json({ error: 'Patient not found' });

  const age = patient.dateOfBirth ? Math.floor((Date.now() - patient.dateOfBirth) / 3.15576e10) : null;
  const lines = [
    '<profile>',
    `Sex: ${patient.gender}; Age: ${age ?? 'unknown'}; Blood group: ${patient.bloodGroup || 'unknown'}`,
    `Height: ${patient.heightCm ?? '?'} cm; Weight: ${patient.weightKg ?? '?'} kg`,
    `Allergies: ${patient.allergies.join(', ') || 'none recorded'}`,
    `Chronic conditions: ${patient.chronicConditions.join(', ') || 'none recorded'}`,
    `Medications: ${patient.medications.map((m) => [m.name, m.dose, m.frequency].filter(Boolean).join(' ')).join('; ') || 'none recorded'}`,
    `Family history: ${patient.familyHistory.join(', ') || 'none recorded'}`,
    `Vaccinations: ${patient.vaccinations.map((v) => `${v.name}${v.dose ? ` (${v.dose})` : ''}${v.date ? ` ${day(v.date)}` : ''}`).join('; ') || 'none recorded'}`,
    '</profile>',
    '<records>',
    ...records.map((r) => `[${day(r.createdAt)}] ${r.category}${r.title ? ` — ${r.title}` : ''}: ${r.recordData}`),
    '</records>',
    '<vitals newest_first="true">',
    ...vitals.map((v) => `[${day(v.recordedAt)}] ${VITAL_TYPES[v.type]?.label}: ${v.value2 != null ? `${v.value}/${v.value2}` : v.value} ${VITAL_TYPES[v.type]?.unit}`),
    '</vitals>',
    '',
    'Write the pre-consultation brief.',
  ];
  await generate({ res, system: SUMMARY_SYSTEM, prompt: lines.join('\n'), effort: 'medium' });
};

module.exports = { status, requireAI, listThreads, getThread, deleteThread, postChat, explainRecord, summarizePatient };
