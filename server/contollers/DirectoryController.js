// Public doctor directory (no sign-in): verified doctors only, never exposing CNICs.

const mongoose = require('mongoose');
const expressAsyncHandler = require('express-async-handler');
const Doctor = require('../models/DoctorModel');
const Appointment = require('../models/AppointmentModel');
const { scheduleOf, slotsFor } = require('../lib/availability');
const { pktDate, addDays } = require('../lib/dates');

const VERIFIED = { $or: [{ 'verification.status': { $exists: false } }, { 'verification.status': 'verified' }], disabled: { $ne: true } };

const publicView = (d) => ({
  id: String(d._id),
  firstName: d.firstName,
  lastName: d.lastName,
  specialization: d.specialization,
  hospital: d.hospital,
  city: d.city || '',
  clinicAddress: d.clinicAddress || '',
  fee: d.fee ?? null,
  yearsExperience: d.yearsExperience ?? null,
  bio: d.bio || '',
  languages: d.languages || [],
  qualifications: d.qualifications || '',
  verified: Boolean(d.verification?.status === 'verified'),
  videoConsults: Boolean(d.availability?.videoConsults),
  hours: scheduleOf(d).days,
});

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// ?q=&city=&specialization=&video=1&page=
const search = expressAsyncHandler(async (req, res) => {
  const { q, city, specialization, video } = req.query;
  const page = Math.max(1, Number(req.query.page) || 1);
  const and = [VERIFIED];
  if (specialization) and.push({ specialization: String(specialization) });
  if (city) and.push({ city: new RegExp(`^${escape(String(city).trim())}`, 'i') });
  if (video === '1') and.push({ 'availability.videoConsults': true });
  if (q) {
    const rx = new RegExp(escape(String(q).trim()), 'i');
    and.push({ $or: [{ firstName: rx }, { lastName: rx }, { hospital: rx }, { specialization: rx }, { qualifications: rx }] });
  }
  const filter = { $and: and };
  const [total, doctors, cities] = await Promise.all([
    Doctor.countDocuments(filter),
    Doctor.find(filter).sort({ 'verification.status': -1, yearsExperience: -1, firstName: 1 }).skip((page - 1) * 24).limit(24).lean(),
    Doctor.distinct('city', VERIFIED),
  ]);
  res.status(200).json({ total, page, pages: Math.ceil(total / 24), doctors: doctors.map(publicView), cities: cities.filter(Boolean).sort() });
});

// Profile plus the next few days with free slots
const profile = expressAsyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: 'Doctor not found' });
  const d = await Doctor.findOne({ _id: req.params.id, ...VERIFIED }).lean();
  if (!d) return res.status(404).json({ error: 'Doctor not found' });
  const today = pktDate();
  const days = Array.from({ length: 14 }, (_, i) => addDays(today, i));
  const booked = await Appointment.find({ doctorCNIC: d.doctorCNIC, date: { $gte: new Date(`${today}T00:00:00Z`) }, status: { $ne: 'cancelled' } }).select('date time').lean();
  const next = [];
  for (const day of days) {
    const taken = booked.filter((a) => a.date.toISOString().slice(0, 10) === day).map((a) => a.time);
    const free = slotsFor(d, day).filter((t) => !taken.includes(t)).length;
    if (free) next.push({ date: day, free });
    if (next.length >= 5) break;
  }
  res.status(200).json({ ...publicView(d), nextAvailable: next });
});

module.exports = { search, profile, VERIFIED };
