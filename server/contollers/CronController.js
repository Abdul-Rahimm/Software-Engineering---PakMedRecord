// Daily job (Vercel Cron, 09:00 Pakistan time): appointment, refill and vaccine reminders, plus housekeeping.
// Protected by CRON_SECRET (Vercel sends it as a Bearer token).

const expressAsyncHandler = require('express-async-handler');
const Appointment = require('../models/AppointmentModel');
const Patient = require('../models/PatientModel');
const Doctor = require('../models/DoctorModel');
const Attachment = require('../models/AttachmentModel');
const ShareLink = require('../models/ShareLinkModel');
const ReminderLog = require('../models/ReminderLogModel');
const { deliver } = require('../lib/messaging');
const { scheduleFor } = require('../lib/epi');
const { pktDate, addDays } = require('../lib/dates');
const { formatTime } = require('../lib/time');
const { deleteFile } = require('../lib/files');
const { settlePending } = require('./PaymentController');

const requireCron = (req, res, next) => {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.get('authorization') !== `Bearer ${secret}`) return res.status(401).json({ error: 'Unauthorized' });
  next();
};

// true the first time a key is seen
const once = async (key) => {
  try {
    await ReminderLog.create({ key });
    return true;
  } catch (err) {
    if (err.code === 11000) return false;
    throw err;
  }
};

const withGuardian = async (patient) => (patient.guardianCNIC ? Patient.findOne({ patientCNIC: patient.guardianCNIC }) : null);

const run = expressAsyncHandler(async (req, res) => {
  const today = pktDate();
  const tomorrow = addDays(today, 1);
  const summary = { appointments: 0, refills: 0, vaccines: 0, cleanedFiles: 0, expiredLinks: 0, paymentsSettled: 0 };

  // 1. Appointments tomorrow
  const appts = await Appointment.find({ date: new Date(`${tomorrow}T00:00:00Z`), status: 'pending' }).lean();
  for (const a of appts) {
    if (!(await once(`appt:${a._id}:day-before`))) continue;
    const [patient, doctor] = await Promise.all([Patient.findOne({ patientCNIC: a.patientCNIC }), Doctor.findOne({ doctorCNIC: a.doctorCNIC }).lean()]);
    if (!patient || !doctor) continue;
    const guardian = await withGuardian(patient);
    if ((guardian || patient).notificationPrefs?.appointmentReminders === false) continue;
    await deliver(patient, {
      type: 'reminder',
      title: 'Appointment tomorrow',
      body: `${a.mode === 'video' ? 'Video visit' : 'Visit'} with Dr. ${doctor.firstName} ${doctor.lastName} tomorrow at ${formatTime(a.time)}${a.mode === 'video' ? '. Join from your Appointments page.' : ` at ${doctor.clinicAddress || doctor.hospital}.`}`,
      link: `/appointments/mine/${patient.patientCNIC}`,
    }, guardian);
    summary.appointments += 1;
  }

  // 2. Medicine refills due in the next 2 days, and 3. vaccines that fall due within a week
  const patients = await Patient.find({ $or: [{ 'medications.refillDate': { $lte: new Date(`${addDays(today, 2)}T23:59:59Z`), $gte: new Date(`${addDays(today, -1)}T00:00:00Z`) } }, { dateOfBirth: { $gte: new Date(Date.now() - 6 * 365 * 86400000) } }] });
  for (const p of patients) {
    const guardian = await withGuardian(p);
    const prefs = (guardian || p).notificationPrefs || {};
    if (prefs.medicationReminders !== false) {
      for (const m of p.medications || []) {
        const due = m.refillDate && m.refillDate.toISOString().slice(0, 10);
        if (!due || due < addDays(today, -1) || due > addDays(today, 2)) continue;
        if (!(await once(`refill:${p.patientCNIC}:${m.name.toLowerCase()}:${due}`))) continue;
        await deliver(p, { type: 'reminder', title: `Refill ${m.name}`, body: `Your ${m.name} runs out on ${due}. Arrange a refill so you don't miss doses.`, link: `/meds/${p.patientCNIC}` }, guardian);
        summary.refills += 1;
      }
    }
    for (const v of scheduleFor(p).items.filter((x) => x.status === 'due')) {
      if (!(await once(`vaccine:${p.patientCNIC}:${v.code}`))) continue;
      await deliver(p, { type: 'reminder', title: `${v.name} is due`, body: `${p.firstName}'s ${v.name} vaccine (${v.protects}) is due on ${v.dueDate}. Visit your nearest EPI centre.`, link: `/vaccines/${p.patientCNIC}` }, guardian);
      summary.vaccines += 1;
    }
  }

  // Online payments whose confirmation never arrived (browser closed mid-checkout)
  summary.paymentsSettled = await settlePending();

  // Housekeeping: uploads never attached to a record, and long-expired share links
  const stale = await Attachment.find({ linked: false, createdAt: { $lt: new Date(Date.now() - 2 * 86400000) } }).select('gridId').lean();
  await Promise.all(stale.map((s) => deleteFile(s.gridId)));
  summary.cleanedFiles = (await Attachment.deleteMany({ _id: { $in: stale.map((s) => s._id) } })).deletedCount;
  summary.expiredLinks = (await ShareLink.deleteMany({ expiresAt: { $lt: new Date(Date.now() - 30 * 86400000) } })).deletedCount;

  console.log('Daily job:', JSON.stringify(summary));
  res.status(200).json({ ok: true, date: today, ...summary });
});

module.exports = { requireCron, run };
