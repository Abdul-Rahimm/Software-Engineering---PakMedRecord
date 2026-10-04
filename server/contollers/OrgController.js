// Hospitals / clinics (organizations): self-registration, branches, departments, doctor
// memberships (many-to-many), staff accounts, front desk and licence verification.
// All tenant routes run behind requireOrg(), so req.tenant = { orgId, org, roles, facilityIds, isAdmin }.

const bcrypt = require('bcrypt');
const crypto = require('crypto');
const mongoose = require('mongoose');
const expressAsyncHandler = require('express-async-handler');
const Organization = require('../models/OrganizationModel');
const Facility = require('../models/FacilityModel');
const Department = require('../models/DepartmentModel');
const Membership = require('../models/MembershipModel');
const Staff = require('../models/StaffModel');
const Doctor = require('../models/DoctorModel');
const Patient = require('../models/PatientModel');
const Appointment = require('../models/AppointmentModel');
const { notify } = require('../lib/notify');
const { deliver } = require('../lib/messaging');
const { logAccess } = require('../lib/accessLog');
const AccessLog = require('../models/AccessLogModel');
const ConsentCode = require('../models/ConsentCodeModel');

const hashCode = (code) => crypto.createHash('sha256').update(`${process.env.JWT_SECRET}:${code}`).digest('hex');
const { isCNIC, isEmail } = require('../lib/validate');
const { completeSignIn } = require('../lib/session');
const { createAppointment, describe, flagFutureAppointments, clearNotice } = require('../lib/appointments');
const { membershipSlots, cleanMembershipSchedule } = require('../lib/availability');
const { canUseFacility, facilityFilter } = require('../lib/tenancy');
const { blockedSlots, scheduleClash } = require('../lib/conflicts');
const { saveFile, deleteFile } = require('../lib/files');
const { forgetAccountStatus } = require('../middleware/auth');
const { TERMS_VERSION } = require('../lib/accounts');
const { flagRefund } = require('./PaymentController');

const PROVINCES = ['Punjab', 'Sindh', 'Khyber Pakhtunkhwa', 'Balochistan', 'Islamabad Capital Territory', 'Gilgit-Baltistan', 'Azad Kashmir'];
const TYPES = ['hospital', 'clinic', 'lab', 'diagnostic'];
const str = (v, max = 200) => String(v ?? '').trim().slice(0, max);
const oid = (v) => (mongoose.isValidObjectId(v) ? new mongoose.Types.ObjectId(String(v)) : null);

const orgFields = (b = {}) => ({
  name: str(b.name, 120),
  type: TYPES.includes(b.type) ? b.type : 'hospital',
  registrationNo: str(b.registrationNo, 60),
  regulator: str(b.regulator, 80),
  city: str(b.city, 60),
  province: PROVINCES.includes(b.province) ? b.province : '',
  address: str(b.address),
  phone: str(b.phone, 30),
  email: str(b.email, 120).toLowerCase(),
  website: str(b.website, 120),
  about: str(b.about, 800),
});

// ---------- registration ----------

// POST /orgs/signup (public) { org: {...}, admin: { name, email, password }, acceptTerms }
// Creates the organization, its first branch and the hospital admin login.
const signup = expressAsyncHandler(async (req, res) => {
  const { org: o = {}, admin = {}, acceptTerms } = req.body || {};
  const fields = orgFields(o);
  if (!fields.name || !fields.city) return res.status(400).json({ error: 'Enter the hospital name and city' });
  if (!str(admin.name) || !isEmail(admin.email)) return res.status(400).json({ error: 'Enter the administrator\'s name and email' });
  if (String(admin.password || '').length < 12) return res.status(400).json({ error: 'The administrator password must be at least 12 characters' });
  if (!acceptTerms) return res.status(400).json({ error: 'Please accept the Terms of Service and Privacy Policy' });
  const email = String(admin.email).trim().toLowerCase();
  if (await Staff.exists({ email })) return res.status(409).json({ error: 'That email already has a hospital account. Sign in instead.' });

  const org = await Organization.create({ ...fields, email: fields.email || email, createdBy: { role: 'staff' } });
  await Facility.create({ orgId: org._id, name: str(o.branchName, 120) || 'Main branch', city: fields.city, province: fields.province, address: fields.address, phone: fields.phone });
  const staff = await Staff.create({
    clinicId: org._id, name: str(admin.name, 80), email, password: await bcrypt.hash(String(admin.password), 10),
    role: 'org_admin', consentAt: new Date(), termsVersion: TERMS_VERSION,
  });
  org.createdBy = { role: 'staff', id: String(staff._id) };
  await org.save();
  const { status, body } = completeSignIn('staff', staff, 'Hospital registered');
  res.status(status === 200 ? 201 : status).json({ ...body, org });
});

// POST /orgs (doctor) - a verified doctor sets up their own clinic and runs it
const createByDoctor = expressAsyncHandler(async (req, res) => {
  if (!req.user.verified) return res.status(403).json({ error: 'Get your PMDC registration verified first' });
  const fields = orgFields({ type: 'clinic', ...req.body });
  if (!fields.name) return res.status(400).json({ error: 'Enter the clinic name' });
  const doctor = await Doctor.findOne({ doctorCNIC: req.user.cnic }).lean();
  const org = await Organization.create({ ...fields, createdBy: { role: 'doctor', id: String(req.user.cnic) }, ownerCNIC: req.user.cnic });
  const branch = await Facility.create({ orgId: org._id, name: 'Main branch', city: fields.city, province: fields.province, address: fields.address, phone: fields.phone });
  const days = doctor?.availability?.days?.length ? doctor.availability.days : [1, 2, 3, 4, 5, 6].map((day) => ({ day, start: '09:00', end: '17:00' }));
  await Membership.create({
    orgId: org._id, doctorCNIC: req.user.cnic, roles: ['doctor', 'org_admin'], status: 'active', facilityIds: [branch._id], fee: doctor?.fee, joinedAt: new Date(),
    availability: { slotMinutes: doctor?.availability?.slotMinutes || 30, blocks: days.map((b) => ({ facilityId: branch._id, day: b.day, start: b.start, end: b.end })) },
  });
  res.status(201).json({ message: 'Clinic created. Upload its registration certificate so patients can find it.', org });
});

// ---------- who am I here ----------

// GET /orgs/mine - hospital staff: their organization; doctors: all their memberships and invitations
const mine = expressAsyncHandler(async (req, res) => {
  if (req.user.role === 'staff') {
    const staff = await Staff.findById(req.user.id).lean();
    const org = staff && (await Organization.findById(staff.clinicId));
    if (!org) return res.status(404).json({ error: 'Organization not found' });
    return res.status(200).json({ org, me: { name: staff.name, email: staff.email, role: staff.role, facilityIds: staff.facilityIds || [] } });
  }
  const memberships = await Membership.find({ doctorCNIC: req.user.cnic, status: { $in: ['active', 'invited'] } }).lean();
  const [orgs, facilities] = await Promise.all([
    Organization.find({ _id: { $in: memberships.map((m) => m.orgId) } }),
    Facility.find({ orgId: { $in: memberships.map((m) => m.orgId) } }).lean(),
  ]);
  res.status(200).json({
    memberships: memberships.map((m) => ({
      ...m,
      org: orgs.find((o) => String(o._id) === String(m.orgId)) || null,
      facilities: facilities.filter((f) => String(f.orgId) === String(m.orgId)),
    })),
  });
});

// GET /orgs/:orgId - members: organization, branches, departments, my roles
const overview = expressAsyncHandler(async (req, res) => {
  const { org, roles, isAdmin, facilityIds } = req.tenant;
  const [facilities, departments, doctors, staff] = await Promise.all([
    Facility.find({ orgId: org._id }).sort({ createdAt: 1 }).lean(),
    Department.find({ orgId: org._id }).sort({ name: 1 }).lean(),
    Membership.countDocuments({ orgId: org._id, status: 'active' }),
    Staff.countDocuments({ clinicId: org._id }),
  ]);
  res.status(200).json({ org, roles, isAdmin, facilityIds, facilities, departments, counts: { doctors, staff, branches: facilities.filter((f) => f.active).length } });
});

const update = expressAsyncHandler(async (req, res) => {
  const { org } = req.tenant;
  const fields = orgFields({ ...org.toObject(), ...req.body });
  if (!fields.name) return res.status(400).json({ error: 'Name is required' });
  // changing the registration number of a verified organization sends it back for review
  if (org.verification?.status === 'verified' && fields.registrationNo !== org.registrationNo) org.verification.status = 'pending';
  Object.assign(org, fields);
  await org.save();
  res.status(200).json({ message: 'Saved', org });
});

// ---------- verification (registration certificate) ----------

const sniff = (b) => {
  if (b.subarray(0, 5).toString('latin1') === '%PDF-') return 'application/pdf';
  if (b[0] === 0x89 && b.subarray(1, 4).toString('latin1') === 'PNG') return 'image/png';
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP') return 'image/webp';
  return null;
};

// POST /orgs/:orgId/verification  raw file bytes; X-Registration-No, X-File-Name headers
const submitVerification = expressAsyncHandler(async (req, res) => {
  const { org } = req.tenant;
  if (org.verification?.status === 'verified') return res.status(409).json({ error: 'Already verified' });
  const regNo = str(req.get('x-registration-no') || org.registrationNo, 60);
  if (regNo.length < 3) return res.status(400).json({ error: 'Enter the registration / licence number' });
  const buf = req.body;
  if (!Buffer.isBuffer(buf) || !buf.length) return res.status(400).json({ error: 'Attach the registration certificate' });
  if (buf.length > 4 * 1024 * 1024) return res.status(413).json({ error: 'File is larger than 4 MB' });
  const mime = sniff(buf);
  if (!mime) return res.status(415).json({ error: 'Use a PDF, JPG, PNG or WebP file' });
  const name = decodeURIComponent(String(req.get('x-file-name') || 'registration')).replace(/[\r\n"]/g, '').slice(0, 200);
  if (org.verification?.document?.gridId) await deleteFile(org.verification.document.gridId);
  const gridId = await saveFile(buf, { name, mime, metadata: { orgId: String(org._id), kind: 'org-registration' } });
  org.registrationNo = regNo;
  org.verification = { status: 'pending', document: { gridId, name, mime, size: buf.length }, submittedAt: new Date() };
  await org.save();
  res.status(200).json({ message: 'Submitted. PakMedRecord usually verifies hospitals within two working days.', org });
});

// ---------- branches & departments ----------

const facilityFields = (b) => ({ name: str(b.name, 120), city: str(b.city, 60), district: str(b.district, 60), province: str(b.province, 60), address: str(b.address), phone: str(b.phone, 30) });

const addFacility = expressAsyncHandler(async (req, res) => {
  const f = facilityFields(req.body || {});
  if (!f.name) return res.status(400).json({ error: 'Enter the branch name' });
  if ((await Facility.countDocuments({ orgId: req.tenant.org._id })) >= 200) return res.status(400).json({ error: 'Branch limit reached' });
  res.status(201).json({ facility: await Facility.create({ ...f, orgId: req.tenant.org._id }) });
});

const updateFacility = expressAsyncHandler(async (req, res) => {
  const facility = await Facility.findOne({ _id: oid(req.params.facilityId), orgId: req.tenant.org._id });
  if (!facility) return res.status(404).json({ error: 'Branch not found' });
  Object.assign(facility, facilityFields({ ...facility.toObject(), ...req.body }));
  if (typeof req.body?.active === 'boolean') {
    if (!req.body.active && (await Facility.countDocuments({ orgId: req.tenant.org._id, active: true })) <= 1) return res.status(400).json({ error: 'An organization needs at least one open branch' });
    if (facility.active && !req.body.active) await flagFutureAppointments({ facilityId: facility._id }, 'branch_closed');
    if (!facility.active && req.body.active) await clearNotice({ facilityId: facility._id }, 'branch_closed');
    facility.active = req.body.active;
  }
  await facility.save();
  res.status(200).json({ facility });
});

const addDepartment = expressAsyncHandler(async (req, res) => {
  const name = str(req.body?.name, 80);
  if (!name) return res.status(400).json({ error: 'Enter the department name' });
  const facilityId = req.body?.facilityId ? oid(req.body.facilityId) : undefined;
  if (facilityId && !(await Facility.exists({ _id: facilityId, orgId: req.tenant.org._id }))) return res.status(400).json({ error: 'Branch not found' });
  res.status(201).json({ department: await Department.create({ orgId: req.tenant.org._id, facilityId, name }) });
});

const removeDepartment = expressAsyncHandler(async (req, res) => {
  const d = await Department.findOneAndDelete({ _id: oid(req.params.departmentId), orgId: req.tenant.org._id });
  if (!d) return res.status(404).json({ error: 'Department not found' });
  await Membership.updateMany({ orgId: req.tenant.org._id, departmentId: d._id }, { $unset: { departmentId: '' } });
  res.status(200).json({ message: 'Department removed' });
});

// ---------- doctors (memberships) ----------

const ownFacilities = async (orgId, ids) => {
  const list = [...new Set((Array.isArray(ids) ? ids : []).map(String))].filter((id) => mongoose.isValidObjectId(id));
  const found = await Facility.find({ _id: { $in: list }, orgId, active: true }).select('_id').lean();
  return found.map((f) => f._id);
};

const doctors = expressAsyncHandler(async (req, res) => {
  const ms = await Membership.find({ orgId: req.tenant.org._id, status: { $in: ['active', 'invited'] } }).lean();
  const docs = await Doctor.find({ doctorCNIC: { $in: ms.map((m) => m.doctorCNIC) } }).select('doctorCNIC firstName lastName specialization email phone verification yearsExperience').lean();
  res.status(200).json(ms.map((m) => {
    const d = docs.find((x) => x.doctorCNIC === m.doctorCNIC);
    // contact details only once the doctor has accepted
    const doctor = d && (m.status === 'active' ? d : { doctorCNIC: d.doctorCNIC, firstName: d.firstName, lastName: d.lastName, specialization: d.specialization });
    return { ...m, doctor: doctor || null };
  }));
});

// POST /orgs/:orgId/doctors { doctorCNIC | pmdcNumber, facilityIds, departmentId, fee }
const inviteDoctor = expressAsyncHandler(async (req, res) => {
  const { org } = req.tenant;
  // unverified (possibly fake) organizations can't probe which CNICs belong to doctors
  if (!requireVerifiedOrg(req.tenant, res)) return;
  const { doctorCNIC, pmdcNumber } = req.body || {};
  const cnic = String(doctorCNIC || '').replace(/\D/g, '');
  const doctor = isCNIC(cnic)
    ? await Doctor.findOne({ doctorCNIC: Number(cnic) })
    : pmdcNumber ? await Doctor.findOne({ 'verification.pmdcNumber': str(pmdcNumber, 40) }) : null;
  if (!doctor) return res.status(404).json({ error: 'No doctor with that CNIC or PMDC number is on PakMedRecord yet. Ask them to sign up as a doctor first.' });
  const facilityIds = await ownFacilities(org._id, req.body?.facilityIds);
  if (!facilityIds.length) return res.status(400).json({ error: 'Choose at least one branch for this doctor' });
  const departmentId = req.body?.departmentId && (await Department.exists({ _id: oid(req.body.departmentId), orgId: org._id })) ? oid(req.body.departmentId) : undefined;
  const existing = await Membership.findOne({ orgId: org._id, doctorCNIC: doctor.doctorCNIC });
  if (existing && ['active', 'invited'].includes(existing.status)) return res.status(409).json({ error: existing.status === 'active' ? 'This doctor is already part of your organization' : 'This doctor has already been invited' });
  const fee = req.body?.fee === '' || req.body?.fee == null ? doctor.fee : Math.max(0, Number(req.body.fee) || 0);
  const membership = existing || new Membership({ orgId: org._id, doctorCNIC: doctor.doctorCNIC });
  Object.assign(membership, { status: 'invited', roles: ['doctor'], facilityIds, departmentId, fee, invitedBy: req.tenant.actor, joinedAt: undefined });
  await membership.save();
  notify('doctor', doctor.doctorCNIC, { type: 'clinic', title: `Invitation from ${org.name}`, body: `${org.name} invited you to see patients there. Accept it from your Hospitals page.`, link: `/clinic/${doctor.doctorCNIC}` });
  res.status(201).json({ message: `Invitation sent to Dr. ${doctor.firstName} ${doctor.lastName}`, membership });
});

// PUT /orgs/:orgId/doctors/:doctorCNIC { facilityIds, departmentId, fee, availability, roles, status:'removed' }
const updateDoctor = expressAsyncHandler(async (req, res) => {
  const { org } = req.tenant;
  const m = await Membership.findOne({ orgId: org._id, doctorCNIC: Number(req.params.doctorCNIC), status: { $in: ['active', 'invited'] } });
  if (!m) return res.status(404).json({ error: 'Doctor not found in this organization' });
  const b = req.body || {};
  if (b.status === 'removed') {
    if (m.roles.includes('org_admin') && !(await Membership.exists({ orgId: org._id, status: 'active', roles: 'org_admin', _id: { $ne: m._id } })) && !(await Staff.exists({ clinicId: org._id, role: 'org_admin', disabled: { $ne: true } }))) {
      return res.status(400).json({ error: 'Make someone else an administrator first' });
    }
    const wasActive = m.status === 'active';
    m.status = 'removed';
    await m.save();
    if (wasActive) {
      const affected = await flagFutureAppointments({ orgId: org._id, doctorCNIC: m.doctorCNIC }, 'doctor_left');
      notify('doctor', m.doctorCNIC, { type: 'clinic', title: `Removed from ${org.name}`, body: `You no longer see patients at ${org.name}.${affected ? ` ${affected} upcoming patient${affected > 1 ? 's were' : ' was'} asked to move their appointment.` : ''}`, link: `/clinic/${m.doctorCNIC}` });
      return res.status(200).json({ message: affected ? `Doctor removed. ${affected} patient${affected > 1 ? 's' : ''} with upcoming appointments ${affected > 1 ? 'were' : 'was'} told to move them.` : 'Doctor removed' });
    }
    return res.status(200).json({ message: 'Invitation cancelled' });
  }
  if (b.facilityIds !== undefined) {
    const ids = await ownFacilities(org._id, b.facilityIds);
    if (!ids.length) return res.status(400).json({ error: 'Choose at least one branch' });
    m.facilityIds = ids;
    // drop schedule blocks at branches the doctor no longer works at
    m.availability.blocks = (m.availability?.blocks || []).filter((x) => ids.map(String).includes(String(x.facilityId)));
    if (m.status === 'active') await flagFutureAppointments({ orgId: org._id, doctorCNIC: m.doctorCNIC, facilityId: { $nin: ids } }, 'doctor_left');
  }
  if (b.departmentId !== undefined) m.departmentId = b.departmentId && (await Department.exists({ _id: oid(b.departmentId), orgId: org._id })) ? oid(b.departmentId) : undefined;
  const oldFee = m.fee;
  if (b.fee !== undefined) m.fee = b.fee === '' || b.fee === null ? undefined : Math.max(0, Number(b.fee) || 0);
  if (b.availability !== undefined) {
    try {
      m.availability = cleanMembershipSchedule(b.availability, m.facilityIds);
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
    const doctor = await Doctor.findOne({ doctorCNIC: m.doctorCNIC }).lean();
    const clash = await scheduleClash(doctor, m.availability.blocks, { orgId: org._id });
    if (clash) return res.status(400).json({ error: `The doctor already works elsewhere then: ${clash}` });
    if (m.status === 'active') notify('doctor', m.doctorCNIC, { type: 'clinic', title: `${org.name} changed your hours`, body: 'Check your hours there on your Hospitals page.', link: `/clinic/${m.doctorCNIC}` });
  }
  if (b.fee !== undefined && m.status === 'active' && m.fee !== oldFee) {
    notify('doctor', m.doctorCNIC, { type: 'clinic', title: `${org.name} changed your fee`, body: `Your consultation fee there is now Rs ${Number(b.fee) || 0}.`, link: `/clinic/${m.doctorCNIC}` });
  }
  if (Array.isArray(b.roles)) m.roles = ['doctor', ...(b.roles.includes('org_admin') ? ['org_admin'] : [])];
  await m.save();
  res.status(200).json({ message: 'Saved', membership: m });
});

// Doctor side: accept/decline an invitation, leave, or edit their own hours at this organization
const respond = expressAsyncHandler(async (req, res) => {
  const m = await Membership.findOne({ orgId: oid(req.params.orgId), doctorCNIC: req.user.cnic, status: 'invited' });
  if (!m) return res.status(404).json({ error: 'Invitation not found' });
  const org = await Organization.findById(m.orgId).lean();
  if (req.body?.accept) {
    if (!req.user.verified) return res.status(403).json({ error: 'Get your PMDC registration verified first' });
    m.status = 'active';
    m.joinedAt = new Date();
  } else m.status = 'declined';
  await m.save();
  res.status(200).json({ message: req.body?.accept ? `You joined ${org?.name}. Set your hours there so patients can book.` : 'Invitation declined', membership: m });
});

const leave = expressAsyncHandler(async (req, res) => {
  const m = await Membership.findOne({ orgId: oid(req.params.orgId), doctorCNIC: req.user.cnic, status: 'active' });
  if (!m) return res.status(404).json({ error: 'Membership not found' });
  if (m.roles.includes('org_admin') && !(await Membership.exists({ orgId: m.orgId, status: 'active', roles: 'org_admin', _id: { $ne: m._id } })) && !(await Staff.exists({ clinicId: m.orgId, role: 'org_admin', disabled: { $ne: true } }))) {
    return res.status(400).json({ error: 'You are the only administrator. Make someone else an administrator first.' });
  }
  m.status = 'removed';
  await m.save();
  const affected = await flagFutureAppointments({ orgId: m.orgId, doctorCNIC: m.doctorCNIC }, 'doctor_left');
  res.status(200).json({ message: affected ? `You left. ${affected} patient${affected > 1 ? 's' : ''} with upcoming appointments there ${affected > 1 ? 'were' : 'was'} asked to move them.` : 'You left this organization' });
});

const myHours = expressAsyncHandler(async (req, res) => {
  const m = await Membership.findOne({ orgId: oid(req.params.orgId), doctorCNIC: req.user.cnic, status: 'active' });
  if (!m) return res.status(404).json({ error: 'Membership not found' });
  try {
    m.availability = cleanMembershipSchedule(req.body || {}, m.facilityIds);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
  const clash = await scheduleClash(await Doctor.findOne({ doctorCNIC: req.user.cnic }).lean(), m.availability.blocks, { orgId: m.orgId });
  if (clash) return res.status(400).json({ error: `These hours clash with your hours elsewhere: ${clash}` });
  await m.save();
  res.status(200).json({ message: 'Hours saved', membership: m });
});

// ---------- staff accounts ----------

const STAFF_ROLES = ['org_admin', 'facility_admin', 'reception', 'billing'];

const staffList = expressAsyncHandler(async (req, res) => {
  res.status(200).json(await Staff.find({ clinicId: req.tenant.org._id }).select('name email role facilityIds disabled createdAt').sort({ createdAt: 1 }));
});

const addStaff = expressAsyncHandler(async (req, res) => {
  const { name, email, password, role = 'reception', facilityIds } = req.body || {};
  if (!str(name) || !isEmail(email)) return res.status(400).json({ error: 'Enter a name and email' });
  if (!STAFF_ROLES.includes(role)) return res.status(400).json({ error: 'Unknown role' });
  if (String(password || '').length < 12) return res.status(400).json({ error: 'Staff passwords must be at least 12 characters' });
  if (await Staff.exists({ email: String(email).toLowerCase().trim() })) return res.status(409).json({ error: 'That email already has a hospital account' });
  const staff = await Staff.create({
    clinicId: req.tenant.org._id, name: str(name, 80), email, password: await bcrypt.hash(String(password), 10), role,
    facilityIds: role === 'org_admin' ? [] : await ownFacilities(req.tenant.org._id, facilityIds),
  });
  res.status(201).json({ message: 'Staff account created', staff });
});

const updateStaff = expressAsyncHandler(async (req, res) => {
  const staff = await Staff.findOne({ _id: oid(req.params.staffId), clinicId: req.tenant.org._id });
  if (!staff) return res.status(404).json({ error: 'Staff not found' });
  const b = req.body || {};
  const lastAdmin = async () => staff.role === 'org_admin'
    && !(await Staff.exists({ clinicId: staff.clinicId, role: 'org_admin', disabled: { $ne: true }, _id: { $ne: staff._id } }))
    && !(await Membership.exists({ orgId: staff.clinicId, status: 'active', roles: 'org_admin' }));
  if (b.remove) {
    if (await lastAdmin()) return res.status(400).json({ error: 'You can\'t remove the last administrator' });
    await staff.deleteOne();
  } else {
    if (b.role !== undefined) {
      if (!STAFF_ROLES.includes(b.role)) return res.status(400).json({ error: 'Unknown role' });
      if (b.role !== 'org_admin' && (await lastAdmin())) return res.status(400).json({ error: 'You can\'t demote the last administrator' });
      staff.role = b.role;
    }
    if (b.facilityIds !== undefined) staff.facilityIds = staff.role === 'org_admin' ? [] : await ownFacilities(staff.clinicId, b.facilityIds);
    if (typeof b.disabled === 'boolean') {
      if (b.disabled && (await lastAdmin())) return res.status(400).json({ error: 'You can\'t disable the last administrator' });
      staff.disabled = b.disabled;
    }
    if (b.password) {
      if (String(b.password).length < 12) return res.status(400).json({ error: 'Staff passwords must be at least 12 characters' });
      staff.password = await bcrypt.hash(String(b.password), 10);
      staff.passwordChangedAt = new Date();
    }
    await staff.save();
  }
  forgetAccountStatus('staff', String(staff._id));
  res.status(200).json({ message: 'Saved' });
});

// ---------- front desk ----------

// GET /orgs/:orgId/desk?date=&facilityId= - the day's appointments across the organization's doctors
const deskDay = expressAsyncHandler(async (req, res) => {
  const t = req.tenant;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(String(req.query.date)) ? req.query.date : new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Karachi' });
  const facilityQ = req.query.facilityId && canUseFacility(t, req.query.facilityId) ? { facilityId: oid(req.query.facilityId) } : facilityFilter(t);
  const [facilities, memberships, appointments] = await Promise.all([
    Facility.find({ orgId: t.org._id, active: true, ...(t.facilityIds.length && { _id: { $in: t.facilityIds.map(oid) } }) }).lean(),
    Membership.find({ orgId: t.org._id, status: 'active', roles: 'doctor' }).lean(),
    Appointment.find({ orgId: t.org._id, date, ...facilityQ }).sort({ time: 1 }).lean(),
  ]);
  const doctorsInfo = await Doctor.find({ doctorCNIC: { $in: memberships.map((m) => m.doctorCNIC) } }).select('doctorCNIC firstName lastName specialization travelBufferMinutes').lean();
  const patients = await Patient.find({ patientCNIC: { $in: appointments.map((a) => a.patientCNIC) } }).select('patientCNIC firstName lastName gender phone').lean();
  res.status(200).json({
    date,
    org: { _id: t.org._id, name: t.org.name, verification: { status: t.org.verification?.status } },
    roles: t.roles,
    facilities,
    doctors: await Promise.all(memberships.map(async (m) => {
      const d = doctorsInfo.find((x) => x.doctorCNIC === m.doctorCNIC);
      const slots = {};
      const blocked = {};
      for (const fid of m.facilityIds || []) {
        slots[String(fid)] = membershipSlots(m, fid, date);
        // busy here or elsewhere (other hospitals, travel time)
        blocked[String(fid)] = d ? await blockedSlots({ doctor: d, date, slots: slots[String(fid)], durationMinutes: m.availability?.slotMinutes || 30, place: { facilityId: fid } }) : [];
      }
      return {
        doctorCNIC: m.doctorCNIC, firstName: d?.firstName, lastName: d?.lastName, specialization: d?.specialization, fee: m.fee,
        facilityIds: (m.facilityIds || []).map(String), slots, blocked,
      };
    })),
    appointments: appointments.map((a) => ({ ...a, patient: patients.find((p) => p.patientCNIC === a.patientCNIC) || null })),
  });
});

// Only verified hospitals may look patients up by CNIC, they see a masked name (enough to confirm
// with the person at the counter), every lookup shows in the patient's "who viewed my record", and
// each organization is limited to LOOKUPS_PER_HOUR distinct look-ups.
const LOOKUPS_PER_HOUR = Number(process.env.DESK_LOOKUPS_PER_HOUR) || 60;
const mask = (s = '') => (s.length <= 2 ? `${s[0] || ''}*` : `${s.slice(0, 2)}${'*'.repeat(Math.min(6, s.length - 2))}`);
const requireVerifiedOrg = (t, res) => {
  if (t.org.verification?.status === 'verified') return true;
  res.status(403).json({ error: 'Your hospital must be verified by PakMedRecord before it can do this.', code: 'ORG_NOT_VERIFIED' });
  return false;
};
const hospitalActor = (t) => ({ role: 'hospital', id: t.actor.id, name: `${t.org.name} (front desk)`, orgId: String(t.org._id) });

const deskPatient = expressAsyncHandler(async (req, res) => {
  const t = req.tenant;
  if (!requireVerifiedOrg(t, res)) return;
  const raw = String(req.params.cnic).replace(/\D/g, '');
  if (!isCNIC(raw)) return res.status(400).json({ error: 'Enter a 13-digit CNIC' });
  const since = new Date(Date.now() - 3600 * 1000);
  if ((await AccessLog.countDocuments({ orgId: String(t.org._id), action: 'Looked you up at the front desk', createdAt: { $gte: since } })) >= LOOKUPS_PER_HOUR) {
    return res.status(429).json({ error: 'Too many patient look-ups this hour. Try again later.' });
  }
  const p = await Patient.findOne({ patientCNIC: Number(raw) }).select('patientCNIC firstName lastName gender phone dateOfBirth').lean();
  if (!p) return res.status(404).json({ error: 'No patient with that CNIC. Ask them to sign up on PakMedRecord first.' });
  await logAccess(p.patientCNIC, hospitalActor(t), 'Looked you up at the front desk', req.ip);
  const returning = await Appointment.exists({ orgId: t.org._id, patientCNIC: p.patientCNIC, status: { $in: ['pending', 'completed'] } });
  const age = p.dateOfBirth ? Math.floor((Date.now() - new Date(p.dateOfBirth)) / (365.25 * 86400000)) : null;
  res.status(200).json({
    patientCNIC: p.patientCNIC,
    name: `${mask(p.firstName)} ${mask(p.lastName)}`,
    gender: p.gender,
    age,
    phoneEnding: p.phone ? String(p.phone).replace(/\D/g, '').slice(-4) : null,
    returning: Boolean(returning), // seen here before: no consent code needed
  });
});

// POST /orgs/:orgId/desk/consent { patientCNIC } - sends the patient a 6-digit code to read out
const deskConsent = expressAsyncHandler(async (req, res) => {
  const t = req.tenant;
  if (!requireVerifiedOrg(t, res)) return;
  const cnic = Number(String(req.body?.patientCNIC || '').replace(/\D/g, ''));
  const patient = await Patient.findOne({ patientCNIC: cnic });
  if (!patient) return res.status(404).json({ error: 'Patient not found' });
  const recent = await ConsentCode.findOne({ orgId: t.org._id, patientCNIC: cnic, createdAt: { $gte: new Date(Date.now() - 60 * 1000) } });
  if (recent) return res.status(429).json({ error: 'A code was just sent. Wait a minute before sending another.' });
  const code = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
  await ConsentCode.create({ orgId: t.org._id, patientCNIC: cnic, codeHash: hashCode(code), expiresAt: new Date(Date.now() + 10 * 60 * 1000) });
  const guardian = patient.guardianCNIC ? await Patient.findOne({ patientCNIC: patient.guardianCNIC }) : null;
  const channels = await deliver(patient, {
    type: 'appointment',
    title: `Booking code: ${code}`,
    body: `${t.org.name} wants to book an appointment for you. If you are at their counter or on the phone with them, tell them this code: ${code}. It expires in 10 minutes. If you didn't ask for this, ignore it.`,
    link: `/appointments/mine/${cnic}`,
  }, guardian);
  logAccess(cnic, hospitalActor(t), 'Asked to book an appointment for you', req.ip);
  res.status(200).json({ message: 'Code sent to the patient', channels });
});

const checkConsent = async (orgId, patientCNIC, code) => {
  const c = await ConsentCode.findOne({ orgId, patientCNIC, usedAt: { $exists: false }, expiresAt: { $gt: new Date() } }).sort({ createdAt: -1 });
  if (!c || c.attempts >= 5) return false;
  if (c.codeHash !== hashCode(String(code || '').trim())) {
    c.attempts += 1;
    await c.save();
    return false;
  }
  c.usedAt = new Date();
  await c.save();
  return true;
};

const deskBook = expressAsyncHandler(async (req, res) => {
  const t = req.tenant;
  const facilityId = req.body?.facilityId;
  if (!facilityId || !canUseFacility(t, facilityId)) return res.status(403).json({ error: 'Choose one of your branches' });
  if (!requireVerifiedOrg(t, res)) return;
  const patientCNIC = Number(String(req.body?.patientCNIC || '').replace(/\D/g, ''));
  // new patients must agree: they read out the code we sent them; returning patients don't need one
  const returning = await Appointment.exists({ orgId: t.org._id, patientCNIC, status: { $in: ['pending', 'completed'] } });
  if (!returning && !(await checkConsent(t.org._id, patientCNIC, req.body?.consentCode))) {
    return res.status(403).json({ error: 'Enter the booking code the patient received (send one first).', code: 'CONSENT_REQUIRED' });
  }
  const { status, body } = await createAppointment({
    ...req.body, orgId: t.org._id, facilityId, patientCNIC, doctorCNIC: Number(req.body?.doctorCNIC),
    bookedBy: { role: 'staff', id: t.actor.id },
  });
  res.status(status).json(body);
});

// { action: 'check-in' | 'undo-check-in' | 'no-show' | 'cancel' }
const deskUpdate = expressAsyncHandler(async (req, res) => {
  const t = req.tenant;
  const a = await Appointment.findOne({ _id: oid(req.params.id), orgId: t.org._id, ...facilityFilter(t) });
  if (!a) return res.status(404).json({ error: 'Appointment not found' });
  const action = req.body?.action;
  if (a.status !== 'pending' && action !== 'undo-check-in') return res.status(409).json({ error: `This appointment is ${a.status}` });
  if (action === 'check-in') {
    a.checkedInAt = new Date();
    notify('doctor', a.doctorCNIC, { type: 'checkin', title: 'Patient checked in', body: `Your ${a.time} patient has arrived.`, link: `/appointments/fetch/${a.doctorCNIC}` });
  } else if (action === 'undo-check-in') a.checkedInAt = undefined;
  else if (action === 'no-show') a.status = 'no-show';
  else if (action === 'cancel') {
    a.status = 'cancelled';
    a.cancelledBy = 'doctor';
    a.cancelReason = str(req.body?.reason || `Cancelled by ${t.org.name}`, 300);
    await flagRefund(a);
    notify('patient', a.patientCNIC, { type: 'cancelled', title: 'Appointment cancelled', body: `${t.org.name} cancelled your appointment on ${describe(a)}: ${a.cancelReason}`, link: `/appointments/mine/${a.patientCNIC}` });
  } else return res.status(400).json({ error: 'Unknown action' });
  await a.save();
  res.status(200).json({ message: 'Updated', appointment: a });
});

module.exports = {
  signup, createByDoctor, mine, overview, update, submitVerification, addFacility, updateFacility, addDepartment, removeDepartment,
  doctors, inviteDoctor, updateDoctor, respond, leave, myHours, staffList, addStaff, updateStaff, deskDay, deskPatient, deskConsent, deskBook, deskUpdate,
};
