// Practice analytics for a doctor, or a whole clinic for its admins.

const mongoose = require('mongoose');
const expressAsyncHandler = require('express-async-handler');
const Appointment = require('../models/AppointmentModel');
const Doctor = require('../models/DoctorModel');
const Clinic = require('../models/ClinicModel');
const { activeDoctors } = require('./ClinicController');

const ymd = (d) => new Date(d).toISOString().slice(0, 10);

const summarize = (appointments, days) => {
  const today = new Date().toISOString().slice(0, 10);
  const past = appointments.filter((a) => ymd(a.date) <= today);
  const by = (s) => past.filter((a) => a.status === s).length;
  const completed = by('completed');
  const noShows = by('no-show');
  const cancelled = by('cancelled');
  const attendedOrMissed = completed + noShows;

  // patients seen before the window count as returning
  const firstSeen = {};
  for (const a of [...appointments].sort((x, y) => new Date(x.date) - new Date(y.date))) {
    firstSeen[a.patientCNIC] ||= ymd(a.date);
  }
  const patients = new Set(past.map((a) => a.patientCNIC));
  const hours = Array(24).fill(0);
  const weekdays = Array(7).fill(0);
  for (const a of past.filter((x) => x.status !== 'cancelled')) {
    hours[Number(String(a.time).slice(0, 2))] += 1;
    weekdays[new Date(a.date).getUTCDay()] += 1;
  }
  const revenue = past.filter((a) => a.payment?.status === 'paid').reduce((s, a) => s + (a.fee || 0), 0);
  const outstanding = past.filter((a) => a.status === 'completed' && a.payment?.status !== 'paid').reduce((s, a) => s + (a.fee || 0), 0);
  const months = {};
  for (const a of past) {
    const m = ymd(a.date).slice(0, 7);
    months[m] ||= { month: m, completed: 0, noShows: 0, cancelled: 0, revenue: 0 };
    if (a.status === 'completed') months[m].completed += 1;
    if (a.status === 'no-show') months[m].noShows += 1;
    if (a.status === 'cancelled') months[m].cancelled += 1;
    if (a.payment?.status === 'paid') months[m].revenue += a.fee || 0;
  }
  const returning = [...patients].filter((p) => past.filter((a) => a.patientCNIC === p && a.status === 'completed').length > 1).length;
  return {
    days,
    total: past.length,
    upcoming: appointments.filter((a) => ymd(a.date) > today && a.status === 'pending').length,
    completed, noShows, cancelled,
    noShowRate: attendedOrMissed ? Math.round((noShows / attendedOrMissed) * 100) : null,
    cancellationRate: past.length ? Math.round((cancelled / past.length) * 100) : null,
    patients: patients.size,
    returningPatients: returning,
    returnRate: patients.size ? Math.round((returning / patients.size) * 100) : null,
    videoVisits: past.filter((a) => a.mode === 'video' && a.status === 'completed').length,
    revenue, outstanding,
    hours, weekdays,
    months: Object.values(months).sort((a, b) => a.month.localeCompare(b.month)),
  };
};

const windowFilter = (days) => ({ date: { $gte: new Date(Date.now() - days * 86400000) } });

// GET /analytics/doctor/:doctorCNIC?days=90
const doctor = expressAsyncHandler(async (req, res) => {
  const days = Math.min(365, Math.max(7, Number(req.query.days) || 90));
  const list = await Appointment.find({ doctorCNIC: Number(req.params.doctorCNIC), ...windowFilter(days) }).lean();
  res.status(200).json(summarize(list, days));
});

// GET /analytics/clinic/:id?days=90 (clinic admins)
const clinic = expressAsyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: 'Clinic not found' });
  const c = await Clinic.findById(req.params.id);
  const me = c?.doctors.find((d) => d.doctorCNIC === req.user.cnic && d.status === 'active');
  if (!me) return res.status(404).json({ error: 'Clinic not found' });
  if (me.role !== 'admin') return res.status(403).json({ error: 'Only clinic admins can see clinic analytics' });
  const days = Math.min(365, Math.max(7, Number(req.query.days) || 90));
  const cnics = activeDoctors(c);
  const [list, doctors] = await Promise.all([
    Appointment.find({ doctorCNIC: { $in: cnics }, ...windowFilter(days) }).lean(),
    Doctor.find({ doctorCNIC: { $in: cnics } }).select('doctorCNIC firstName lastName specialization').lean(),
  ]);
  res.status(200).json({
    clinic: { _id: c._id, name: c.name },
    ...summarize(list, days),
    perDoctor: doctors.map((d) => {
      const s = summarize(list.filter((a) => a.doctorCNIC === d.doctorCNIC), days);
      return { doctorCNIC: d.doctorCNIC, name: `Dr. ${d.firstName} ${d.lastName}`, specialization: d.specialization, completed: s.completed, noShowRate: s.noShowRate, revenue: s.revenue, patients: s.patients };
    }),
  });
});

module.exports = { doctor, clinic };
