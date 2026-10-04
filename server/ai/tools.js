// Tools the AI assistant can call. Every handler runs as the signed-in user:
// patients only ever see their own data, doctors only their affiliated patients.

const { z } = require('zod');
const Patient = require('../models/PatientModel');
const Doctor = require('../models/DoctorModel');
const MedicalRecord = require('../models/RecordModel');
const TempRecord = require('../models/tempRecordModel');
const Appointment = require('../models/AppointmentModel');
const Affiliation = require('../models/AffiliationModel');
const Note = require('../models/NotesModel');
const Vital = require('../models/VitalModel');
const { RECORD_CATEGORIES, SPECIALIZATIONS, VITAL_TYPES } = require('../models/constants');
const { createAppointment, resolveLocation } = require('../lib/appointments');
const { doctorLocations } = require('../lib/tenancy');

const day = (d) => (d ? new Date(d).toISOString().slice(0, 10) : null);

// Text the AI extracted from files attached to a record (kept short for the model's context)
const docsOf = (r) => (r.attachments || [])
  .filter((a) => a && a.ocr?.status === 'done' && a.ocr.text)
  .map((a) => ({ file: a.name, text: a.ocr.text.slice(0, 4000) }));
const todayKey = () => new Date().toISOString().slice(0, 10);

const doctorBrief = (d) => d && ({
  doctorCNIC: d.doctorCNIC,
  name: `Dr. ${d.firstName} ${d.lastName}`,
  specialization: d.specialization,
  hospital: d.hospital,
  yearsExperience: d.yearsExperience ?? null,
});

const healthProfile = (p) => ({
  name: `${p.firstName} ${p.lastName}`,
  gender: p.gender,
  dateOfBirth: day(p.dateOfBirth),
  bloodGroup: p.bloodGroup || null,
  heightCm: p.heightCm ?? null,
  weightKg: p.weightKg ?? null,
  allergies: p.allergies,
  chronicConditions: p.chronicConditions,
  medications: p.medications,
  familyHistory: p.familyHistory,
  vaccinations: (p.vaccinations || []).map((v) => ({ name: v.name, dose: v.dose, date: day(v.date) })),
  primaryHospital: p.hospital,
});

const formatVital = (v) => ({
  type: VITAL_TYPES[v.type]?.label || v.type,
  value: v.value2 != null ? `${v.value}/${v.value2}` : v.value,
  unit: VITAL_TYPES[v.type]?.unit,
  recordedAt: v.recordedAt,
  note: v.note || undefined,
});

const careTeamCNICs = async (patientCNIC) =>
  (await Affiliation.find({ patientCNIC })).flatMap((a) => a.doctorCNIC);

const isAffiliated = async (patientCNIC, doctorCNIC) => Boolean(await Affiliation.findOne({ patientCNIC, doctorCNIC }));

// ---------- tool definitions ----------
// Each entry: name, description, schema (zod, validates model input), handler(input, user)

const patientTools = [
  {
    name: 'get_health_profile',
    description: "Get the patient's health profile: blood group, allergies, chronic conditions, current medications, family history, vaccinations, height and weight.",
    schema: z.object({}),
    handler: async (_input, user) => healthProfile(await Patient.findOne({ patientCNIC: user.cnic })),
  },
  {
    name: 'list_records',
    description: 'List the patient\'s verified medical records (newest first). Optionally filter by category.',
    schema: z.object({
      category: z.enum(RECORD_CATEGORIES).optional(),
      limit: z.number().int().min(1).max(50).optional(),
    }),
    handler: async ({ category, limit = 20 }, user) => {
      const filter = { patientCNIC: user.cnic, ...(category && { category }) };
      const records = await MedicalRecord.find(filter).sort({ createdAt: -1 }).limit(limit).populate('attachments');
      const doctors = await Doctor.find({ doctorCNIC: { $in: records.map((r) => r.doctorCNIC) } });
      const byId = Object.fromEntries(doctors.map((d) => [d.doctorCNIC, d]));
      return records.map((r) => ({
        date: day(r.createdAt),
        title: r.title || null,
        category: r.category,
        doctor: byId[r.doctorCNIC] ? `Dr. ${byId[r.doctorCNIC].firstName} ${byId[r.doctorCNIC].lastName}` : null,
        details: r.recordData,
        attachedDocuments: docsOf(r),
      }));
    },
  },
  {
    name: 'list_submissions',
    description: 'List records the patient submitted for doctor review, with their status (pending, approved, rejected) and any review note.',
    schema: z.object({}),
    handler: async (_input, user) =>
      (await TempRecord.find({ patientCNIC: user.cnic }).sort({ createdAt: -1 }).limit(20)).map((t) => ({
        submitted: day(t.createdAt), title: t.title || null, category: t.category, status: t.status, reviewNote: t.reviewNote || null,
      })),
  },
  {
    name: 'list_appointments',
    description: "List the patient's appointments. 'upcoming' = not yet happened and not cancelled.",
    schema: z.object({ which: z.enum(['upcoming', 'past', 'all']).optional() }),
    handler: async ({ which = 'upcoming' }, user) => {
      const appts = await Appointment.find({ patientCNIC: user.cnic }).sort({ date: 1, time: 1 });
      const doctors = await Doctor.find({ doctorCNIC: { $in: appts.map((a) => a.doctorCNIC) } });
      const byId = Object.fromEntries(doctors.map((d) => [d.doctorCNIC, d]));
      const today = todayKey();
      return appts
        .filter((a) => which === 'all' || (which === 'upcoming' ? a.status === 'pending' && day(a.date) >= today : a.status !== 'pending' || day(a.date) < today))
        .map((a) => ({ date: day(a.date), time: a.time, status: a.status, reason: a.reason || null, doctor: doctorBrief(byId[a.doctorCNIC]) }));
    },
  },
  {
    name: 'list_vitals',
    description: 'List recent vital-sign readings the patient logged (blood pressure, glucose, heart rate, weight, temperature, oxygen).',
    schema: z.object({
      type: z.enum(Object.keys(VITAL_TYPES)).optional(),
      limit: z.number().int().min(1).max(100).optional(),
    }),
    handler: async ({ type, limit = 30 }, user) =>
      (await Vital.find({ patientCNIC: user.cnic, ...(type && { type }) }).sort({ recordedAt: -1 }).limit(limit)).map(formatVital),
  },
  {
    name: 'log_vital',
    description: 'Save a new vital-sign reading for the patient. Only call this after the patient has clearly given the value and asked you to log it. For blood pressure, value is systolic and value2 is diastolic.',
    schema: z.object({
      type: z.enum(Object.keys(VITAL_TYPES)),
      value: z.number(),
      value2: z.number().optional(),
      note: z.string().max(200).optional(),
    }),
    handler: async ({ type, value, value2, note }, user) => {
      if (VITAL_TYPES[type].paired && value2 == null) return { error: 'Blood pressure needs both systolic and diastolic values' };
      const v = await Vital.create({ patientCNIC: user.cnic, type, value, value2, note });
      return { saved: formatVital(v) };
    },
  },
  {
    name: 'list_care_team',
    description: "List the doctors in the patient's care team (the only doctors they can book with or send records to).",
    schema: z.object({}),
    handler: async (_input, user) => (await Doctor.find({ doctorCNIC: { $in: await careTeamCNICs(user.cnic) } })).map(doctorBrief),
  },
  {
    name: 'search_doctors',
    description: 'Search all registered doctors by name/hospital text and/or specialization, to suggest who the patient could add to their care team.',
    schema: z.object({
      query: z.string().max(80).optional(),
      specialization: z.enum(SPECIALIZATIONS).optional(),
    }),
    handler: async ({ query, specialization }) => {
      const filter = {};
      if (specialization) filter.specialization = specialization;
      if (query) {
        const rx = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
        filter.$or = [{ firstName: rx }, { lastName: rx }, { hospital: rx }];
      }
      return (await Doctor.find(filter).limit(15)).map(doctorBrief);
    },
  },
  {
    name: 'get_doctor_locations',
    description: 'List where a doctor can be booked: each hospital branch (orgId + facilityId) and/or their private practice (orgId null). Call this before checking free slots.',
    schema: z.object({ doctorCNIC: z.number().int() }),
    handler: async ({ doctorCNIC }) => doctorLocations(doctorCNIC),
  },
  {
    name: 'get_booked_times',
    description: 'Get the free appointment slots for a doctor on a given date (YYYY-MM-DD) at one location from get_doctor_locations (pass its orgId and facilityId; omit both for private practice). Only offer times from freeSlots.',
    schema: z.object({ doctorCNIC: z.number().int(), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), orgId: z.string().nullable().optional(), facilityId: z.string().nullable().optional() }),
    handler: async ({ doctorCNIC, date, orgId, facilityId }) => {
      const doctor = await Doctor.findOne({ doctorCNIC });
      if (!doctor) return { error: 'Doctor not found' };
      const place = await resolveLocation(doctor, { orgId: orgId || undefined, facilityId: facilityId || undefined }, date);
      if (place.error) return { error: place.error };
      const taken = (await Appointment.find({ doctorCNIC, date, status: { $ne: 'cancelled' } })).map((a) => a.time);
      const freeSlots = place.slots.filter((t) => !taken.includes(t));
      return { date, place: place.label, freeSlots, closed: freeSlots.length === 0 && taken.length === 0, videoConsults: place.videoConsults, fee: place.fee ?? null };
    },
  },
  {
    name: 'book_appointment',
    description: 'Book an appointment with a doctor in the patient\'s care team. ONLY call this after the patient has explicitly confirmed the doctor, place, date and time you proposed. Pass the orgId and facilityId of the location (omit for private practice). date is YYYY-MM-DD, time is HH:MM (24-hour) and must be one of the doctor\'s free slots. mode is "video" only if the doctor offers video consultations and the patient asked for one.',
    schema: z.object({
      doctorCNIC: z.number().int(),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      time: z.string().regex(/^\d{2}:\d{2}$/),
      reason: z.string().max(300).optional(),
      mode: z.enum(['in-person', 'video']).optional(),
      orgId: z.string().nullable().optional(),
      facilityId: z.string().nullable().optional(),
    }),
    handler: async (input, user) => {
      const { status, body } = await createAppointment({ ...input, orgId: input.orgId || undefined, facilityId: input.facilityId || undefined, patientCNIC: user.cnic, bookedBy: { role: 'assistant' } });
      return status === 201
        ? { booked: { date: input.date, time: input.time, doctorCNIC: input.doctorCNIC, reason: input.reason || null } }
        : { error: body.error };
    },
  },
  {
    name: 'add_note',
    description: 'Save a private note for the patient (e.g. questions for their next visit). Only call when the patient asks you to save or remember something.',
    schema: z.object({ text: z.string().min(1).max(2000) }),
    handler: async ({ text }, user) => {
      await Note.create({ patientCNIC: user.cnic, note: text });
      return { saved: true };
    },
  },
];

const doctorTools = [
  {
    name: 'list_my_patients',
    description: 'List patients who have added this doctor to their care team.',
    schema: z.object({}),
    handler: async (_input, user) => {
      const cnics = [...new Set((await Affiliation.find({ doctorCNIC: user.cnic })).map((a) => a.patientCNIC))];
      return (await Patient.find({ patientCNIC: { $in: cnics } })).map((p) => ({
        patientCNIC: p.patientCNIC, name: `${p.firstName} ${p.lastName}`, gender: p.gender, dateOfBirth: day(p.dateOfBirth),
      }));
    },
  },
  {
    name: 'get_patient_overview',
    description: "Get an affiliated patient's health profile, all verified records and recent vitals. Use patientCNIC from list_my_patients.",
    schema: z.object({ patientCNIC: z.number().int() }),
    handler: async ({ patientCNIC }, user) => {
      if (!(await isAffiliated(patientCNIC, user.cnic))) return { error: 'This patient has not added you to their care team.' };
      const [patient, records, vitals] = await Promise.all([
        Patient.findOne({ patientCNIC }),
        MedicalRecord.find({ patientCNIC }).sort({ createdAt: -1 }).limit(50).populate('attachments'),
        Vital.find({ patientCNIC }).sort({ recordedAt: -1 }).limit(40),
      ]);
      if (!patient) return { error: 'Patient not found' };
      return {
        profile: healthProfile(patient),
        records: records.map((r) => ({ date: day(r.createdAt), title: r.title || null, category: r.category, details: r.recordData, attachedDocuments: docsOf(r) })),
        recentVitals: vitals.map(formatVital),
      };
    },
  },
  {
    name: 'list_appointments',
    description: "List this doctor's appointments: 'today', 'upcoming' (from today, not cancelled/completed) or 'past'.",
    schema: z.object({ which: z.enum(['today', 'upcoming', 'past']).optional() }),
    handler: async ({ which = 'upcoming' }, user) => {
      const appts = await Appointment.find({ doctorCNIC: user.cnic }).sort({ date: 1, time: 1 });
      const patients = await Patient.find({ patientCNIC: { $in: appts.map((a) => a.patientCNIC) } });
      const byId = Object.fromEntries(patients.map((p) => [p.patientCNIC, p]));
      const today = todayKey();
      return appts
        .filter((a) => {
          const d = day(a.date);
          if (which === 'today') return d === today && a.status !== 'cancelled';
          if (which === 'upcoming') return d >= today && a.status === 'pending';
          return d < today || a.status !== 'pending';
        })
        .map((a) => ({
          date: day(a.date), time: a.time, status: a.status, reason: a.reason || null,
          patient: byId[a.patientCNIC] ? `${byId[a.patientCNIC].firstName} ${byId[a.patientCNIC].lastName}` : String(a.patientCNIC),
          patientCNIC: a.patientCNIC,
        }));
    },
  },
  {
    name: 'list_pending_reviews',
    description: 'List records patients submitted that are waiting for this doctor to approve or reject.',
    schema: z.object({}),
    handler: async (_input, user) => {
      const pending = await TempRecord.find({ doctorCNIC: user.cnic, status: 'pending' }).sort({ createdAt: 1 });
      const patients = await Patient.find({ patientCNIC: { $in: pending.map((t) => t.patientCNIC) } });
      const byId = Object.fromEntries(patients.map((p) => [p.patientCNIC, p]));
      return pending.map((t) => ({
        submitted: day(t.createdAt), title: t.title || null, category: t.category, details: t.recordData,
        patient: byId[t.patientCNIC] ? `${byId[t.patientCNIC].firstName} ${byId[t.patientCNIC].lastName}` : String(t.patientCNIC),
      }));
    },
  },
];

const TOOLSETS = { patient: patientTools, doctor: doctorTools };

// Provider-neutral tool specs (JSON Schema from zod); each AI provider adapter maps them to its own format.
// Kept in a fixed order so the prompt prefix stays cacheable.
const toolSpecs = (role) =>
  TOOLSETS[role].map((t) => {
    const parameters = z.toJSONSchema(t.schema);
    delete parameters.$schema;
    return { name: t.name, description: t.description, parameters };
  });

// Human-readable progress labels for the UI
const TOOL_LABELS = {
  get_health_profile: 'Reading your health profile',
  list_records: 'Looking through your records',
  list_submissions: 'Checking your submissions',
  list_appointments: 'Checking appointments',
  list_vitals: 'Reviewing your vitals',
  log_vital: 'Saving your reading',
  list_care_team: 'Checking your care team',
  search_doctors: 'Searching doctors',
  get_doctor_locations: 'Checking where the doctor practises',
  get_booked_times: 'Checking availability',
  book_appointment: 'Booking the appointment',
  add_note: 'Saving a note',
  list_my_patients: 'Looking up your patients',
  get_patient_overview: 'Reading the patient file',
  list_pending_reviews: 'Checking your review queue',
};

// Validate model input against the tool's schema, then run it as the signed-in user
const runTool = async (role, name, input, user) => {
  const tool = TOOLSETS[role].find((t) => t.name === name);
  if (!tool) return { isError: true, content: `Unknown tool: ${name}` };
  const parsed = tool.schema.safeParse(input ?? {});
  if (!parsed.success) {
    return { isError: true, content: `Invalid input: ${parsed.error.issues.map((i) => `${i.path.join('.') || 'input'} ${i.message}`).join('; ')}` };
  }
  try {
    const result = await tool.handler(parsed.data, user);
    return { isError: Boolean(result && result.error), content: JSON.stringify(result) };
  } catch (err) {
    console.error(`AI tool ${name} failed:`, err);
    return { isError: true, content: 'The tool failed unexpectedly.' };
  }
};

module.exports = { toolSpecs, runTool, TOOL_LABELS };
