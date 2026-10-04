// Public doctor directory (no sign-in): verified doctors only, never exposing CNICs.

const mongoose = require('mongoose');
const expressAsyncHandler = require('express-async-handler');
const Doctor = require('../models/DoctorModel');
const Appointment = require('../models/AppointmentModel');
const { scheduleOf, slotsFor } = require('../lib/availability');
const { pktDate, addDays } = require('../lib/dates');
const Organization = require('../models/OrganizationModel');
const Facility = require('../models/FacilityModel');
const Department = require('../models/DepartmentModel');
const Membership = require('../models/MembershipModel');
const { doctorLocations } = require('../lib/tenancy');
const { membershipSlots } = require('../lib/availability');

// Only doctors an admin has explicitly verified (accounts older than verification are not listed publicly)
const VERIFIED = { 'verification.status': 'verified', disabled: { $ne: true } };

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
  if (city) {
    // in that city privately, or at a hospital branch there
    const cityRx = new RegExp(`^${escape(String(city).trim())}`, 'i');
    const fids = await Facility.find({ city: cityRx, active: true }).distinct('_id');
    const viaOrg = await Membership.find({ facilityIds: { $in: fids }, status: 'active', roles: 'doctor' }).distinct('doctorCNIC');
    and.push({ $or: [{ city: cityRx }, { doctorCNIC: { $in: viaOrg } }] });
  }
  if (req.query.org && mongoose.isValidObjectId(req.query.org)) {
    and.push({ doctorCNIC: { $in: await Membership.find({ orgId: req.query.org, status: 'active', roles: 'doctor' }).distinct('doctorCNIC') } });
  }
  if (video === '1') and.push({ 'availability.videoConsults': true });
  if (q) {
    const rx = new RegExp(escape(String(q).trim()), 'i');
    and.push({ $or: [{ firstName: rx }, { lastName: rx }, { hospital: rx }, { specialization: rx }, { qualifications: rx }] });
  }
  const filter = { $and: and };
  const [total, doctors, cities, orgCities] = await Promise.all([
    Doctor.countDocuments(filter),
    Doctor.find(filter).sort({ 'verification.status': -1, yearsExperience: -1, firstName: 1 }).skip((page - 1) * 24).limit(24).lean(),
    Doctor.distinct('city', VERIFIED),
    Facility.distinct('city', { active: true, orgId: { $in: await Organization.find(PUBLIC_ORG).distinct('_id') } }),
  ]);
  const withPlaces = await Promise.all(doctors.map(async (d) => ({
    ...publicView(d),
    places: (await doctorLocations(d.doctorCNIC)).filter((l) => l.kind === 'org').map((l) => ({ orgId: l.orgId, orgName: l.orgName, facilityName: l.facilityName, city: l.city })),
  })));
  res.status(200).json({ total, page, pages: Math.ceil(total / 24), doctors: withPlaces, cities: [...new Set([...cities, ...orgCities].filter(Boolean))].sort() });
});

// Profile plus the next few days with free slots
const PUBLIC_ORG = { 'verification.status': 'verified', suspended: { $ne: true } };

// GET /public/hospitals?q=&city=&type= - verified hospitals/clinics with their branches
const hospitals = expressAsyncHandler(async (req, res) => {
  const filter = { ...PUBLIC_ORG };
  if (['hospital', 'clinic', 'lab', 'diagnostic'].includes(req.query.type)) filter.type = req.query.type;
  if (req.query.q) filter.name = new RegExp(escape(String(req.query.q).trim()), 'i');
  if (req.query.city) {
    const cityRx = new RegExp(`^${escape(String(req.query.city).trim())}`, 'i');
    filter._id = { $in: await Facility.find({ city: cityRx, active: true }).distinct('orgId') };
  }
  const orgs = await Organization.find(filter).sort({ name: 1 }).limit(100).lean();
  const ids = orgs.map((o) => o._id);
  const [facilities, counts] = await Promise.all([
    Facility.find({ orgId: { $in: ids }, active: true }).select('orgId name city address phone').lean(),
    Membership.aggregate([{ $match: { orgId: { $in: ids }, status: 'active', roles: 'doctor' } }, { $group: { _id: '$orgId', n: { $sum: 1 } } }]),
  ]);
  res.status(200).json(orgs.map((o) => ({
    id: String(o._id), name: o.name, type: o.type, city: o.city, province: o.province, phone: o.phone, website: o.website, about: o.about,
    branches: facilities.filter((f) => String(f.orgId) === String(o._id)).map((f) => ({ id: String(f._id), name: f.name, city: f.city, address: f.address, phone: f.phone })),
    doctors: counts.find((c) => String(c._id) === String(o._id))?.n || 0,
  })));
});

// GET /public/hospitals/:id - one hospital: branches, departments, doctors (with where they sit)
const hospital = expressAsyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: 'Hospital not found' });
  const o = await Organization.findOne({ _id: req.params.id, ...PUBLIC_ORG }).lean();
  if (!o) return res.status(404).json({ error: 'Hospital not found' });
  const [facilities, departments, ms] = await Promise.all([
    Facility.find({ orgId: o._id, active: true }).lean(),
    Department.find({ orgId: o._id }).lean(),
    Membership.find({ orgId: o._id, status: 'active', roles: 'doctor' }).lean(),
  ]);
  const docs = await Doctor.find({ doctorCNIC: { $in: ms.map((m) => m.doctorCNIC) }, ...VERIFIED }).lean();
  const today = pktDate();
  res.status(200).json({
    id: String(o._id), name: o.name, type: o.type, city: o.city, province: o.province, address: o.address, phone: o.phone, website: o.website, about: o.about,
    branches: facilities.map((f) => ({ id: String(f._id), name: f.name, city: f.city, address: f.address, phone: f.phone })),
    departments: departments.map((d) => ({ id: String(d._id), name: d.name, branchId: d.facilityId ? String(d.facilityId) : null })),
    doctors: docs.map((d) => {
      const m = ms.find((x) => x.doctorCNIC === d.doctorCNIC);
      const { hours, ...pub } = publicView(d);
      return {
        ...pub,
        fee: m.fee ?? d.fee ?? null,
        videoConsults: Boolean(m.availability?.videoConsults),
        departmentId: m.departmentId ? String(m.departmentId) : null,
        branchIds: (m.facilityIds || []).map(String),
        // open next 7 days at any branch here (a quick "available soon" hint)
        availableSoon: (m.facilityIds || []).some((fid) => Array.from({ length: 7 }, (_, i) => addDays(today, i)).some((day) => membershipSlots(m, fid, day).length)),
      };
    }),
  });
});

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
  const places = (await doctorLocations(d.doctorCNIC)).map(({ kind, orgId, orgName, facilityId, facilityName, city, address, fee, videoConsults }) => ({ kind, orgId, orgName, facilityId, facilityName, city, address, fee, videoConsults }));
  res.status(200).json({ ...publicView(d), nextAvailable: next, places });
});

module.exports = { search, profile, hospitals, hospital, VERIFIED };
