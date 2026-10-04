// Multi-tenancy. Hospitals (organizations) are tenants for operational data: branches, staff,
// doctor memberships, schedules, appointments, payments. Patients and their medical records are
// NOT tenant data: they belong to the patient and are shared per doctor through care grants.
//
// Every request that touches tenant data goes through requireOrg(), which works out from the
// signed-in account (never from the request body) which organization the caller belongs to and
// with which roles, and every tenant query is filtered by that orgId.

const mongoose = require('mongoose');
const Organization = require('../models/OrganizationModel');
const Membership = require('../models/MembershipModel');
const Facility = require('../models/FacilityModel');
const Staff = require('../models/StaffModel');
const Doctor = require('../models/DoctorModel');
const { scheduleOf } = require('./availability');

const ADMIN_ROLES = ['org_admin'];

// What can this signed-in user do in this organization? null = not a member.
const orgAccess = async (user, orgId) => {
  if (!mongoose.isValidObjectId(orgId)) return null;
  let roles = [];
  let facilityIds = [];
  let actor;
  if (user.role === 'staff') {
    const staff = await Staff.findById(user.id).lean();
    if (!staff || staff.disabled || String(staff.clinicId) !== String(orgId)) return null;
    roles = [staff.role || 'reception'];
    facilityIds = (staff.facilityIds || []).map(String);
    actor = { role: 'staff', id: String(staff._id), name: staff.name };
  } else if (user.role === 'doctor') {
    const m = await Membership.findOne({ orgId, doctorCNIC: user.cnic, status: 'active' }).lean();
    if (!m) return null;
    roles = m.roles;
    facilityIds = m.roles.includes('org_admin') ? [] : (m.facilityIds || []).map(String);
    actor = { role: 'doctor', id: String(user.cnic) };
  } else {
    return null;
  }
  const org = await Organization.findById(orgId);
  if (!org) return null;
  const isAdmin = roles.some((r) => ADMIN_ROLES.includes(r));
  return { orgId: String(org._id), org, roles, isAdmin, facilityIds: isAdmin ? [] : facilityIds, actor };
};

// Route guard. allowed = roles that may use the route ('any' = any member).
// orgId comes from the URL (:orgId), or for hospital staff from their own account.
const requireOrg = (...allowed) => async (req, res, next) => {
  try {
    const orgId = req.params.orgId || (req.user.role === 'staff' ? req.user.clinicId : null);
    const access = orgId && (await orgAccess(req.user, orgId));
    // 404 (not 403) so non-members can't even learn an organization's internal ids exist
    if (!access) return res.status(404).json({ error: 'Organization not found' });
    if (access.org.suspended && !access.isAdmin) return res.status(403).json({ error: 'This organization is suspended' });
    const ok = allowed.includes('any') || access.isAdmin || access.roles.some((r) => allowed.includes(r));
    if (!ok) return res.status(403).json({ error: 'Your role in this organization cannot do this' });
    req.tenant = access;
    next();
  } catch (err) {
    next(err);
  }
};

// Facility scope: empty list = all branches
const canUseFacility = (tenant, facilityId) => !tenant.facilityIds.length || tenant.facilityIds.includes(String(facilityId));
const facilityFilter = (tenant) => (tenant.facilityIds.length ? { facilityId: { $in: tenant.facilityIds.map((id) => new mongoose.Types.ObjectId(id)) } } : {});

// Every place a doctor sees patients: active memberships at public organizations (one entry per
// branch), plus their private practice if they have set private hours.
const doctorLocations = async (doctorCNIC, { includeUnverified = false } = {}) => {
  const doctor = await Doctor.findOne({ doctorCNIC: Number(doctorCNIC) }).lean();
  if (!doctor) return [];
  const memberships = await Membership.find({ doctorCNIC: doctor.doctorCNIC, status: 'active', roles: 'doctor' }).lean();
  const orgs = await Organization.find({ _id: { $in: memberships.map((m) => m.orgId) } }).lean();
  const facilities = await Facility.find({ _id: { $in: memberships.flatMap((m) => m.facilityIds || []) }, active: true }).lean();
  const out = [];
  for (const m of memberships) {
    const org = orgs.find((o) => String(o._id) === String(m.orgId));
    if (!org || org.suspended || (!includeUnverified && org.verification?.status !== 'verified')) continue;
    for (const fid of m.facilityIds || []) {
      const f = facilities.find((x) => String(x._id) === String(fid));
      if (!f) continue;
      const hasHours = (m.availability?.blocks || []).some((b) => String(b.facilityId) === String(f._id));
      out.push({
        kind: 'org', orgId: String(org._id), orgName: org.name, orgType: org.type, facilityId: String(f._id), facilityName: f.name,
        city: f.city || org.city || '', address: f.address || '', fee: m.fee ?? doctor.fee ?? null,
        videoConsults: Boolean(m.availability?.videoConsults), hasHours, departmentId: m.departmentId ? String(m.departmentId) : null,
      });
    }
  }
  // Private practice: if the doctor set private hours, or (as before hospitals existed) if they
  // practise nowhere else, in which case the standard Mon-Sat 09:00-17:00 hours apply
  if (doctor.availability?.days?.length || !out.length) {
    const s = scheduleOf(doctor);
    out.push({
      kind: 'private', orgId: null, orgName: 'Private practice', facilityId: null, facilityName: doctor.clinicAddress || doctor.hospital || 'Private clinic',
      city: doctor.city || '', address: doctor.clinicAddress || '', fee: doctor.fee ?? null, videoConsults: s.videoConsults, hasHours: true,
    });
  }
  return out;
};

module.exports = { orgAccess, requireOrg, canUseFacility, facilityFilter, doctorLocations };
