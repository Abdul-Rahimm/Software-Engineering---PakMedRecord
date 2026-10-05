const jwt = require('jsonwebtoken');
const { jwt_secret } = require('../config');
const Affiliation = require('../models/AffiliationModel');
const Doctor = require('../models/DoctorModel');
const Patient = require('../models/PatientModel');
const Admin = require('../models/AdminModel');
const Staff = require('../models/StaffModel');
const { logAccess, actionFor } = require('../lib/accessLog');

// Doctors and patients are identified by CNIC, admins and clinic staff by their id.
// `extra` carries e.g. { guardian } when a parent is acting for a dependent.
const signToken = (role, subject, extra = {}) =>
  jwt.sign(
    role === 'admin' || role === 'staff' ? { role, id: String(subject), ...extra } : { role, cnic: Number(subject), ...extra },
    jwt_secret,
    { expiresIn: '8h' }
  );

// Suspended accounts and tokens issued before a password reset are refused.
// Looked up at most once a minute per account to keep requests fast.
const STATUS_TTL_MS = 60 * 1000;
const statusCache = new Map();
const accountStatus = async (role, subject) => {
  const key = `${role}:${subject}`;
  const hit = statusCache.get(key);
  if (hit && Date.now() - hit.at < STATUS_TTL_MS) return hit.value;
  const fields = 'disabled passwordChangedAt';
  let doc;
  if (role === 'doctor') doc = await Doctor.findOne({ doctorCNIC: subject }).select(`${fields} verification`).lean();
  else if (role === 'patient') doc = await Patient.findOne({ patientCNIC: subject }).select(fields).lean();
  else if (role === 'admin') doc = await Admin.findById(subject).select(fields).lean();
  else if (role === 'staff') doc = await Staff.findById(subject).select(`${fields} clinicId`).lean();
  const value = doc
    ? {
        exists: true,
        disabled: Boolean(doc.disabled),
        changedAtMs: doc.passwordChangedAt ? new Date(doc.passwordChangedAt).getTime() : 0,
        verified: role !== 'doctor' || !doc.verification?.status || doc.verification.status === 'verified',
        clinicId: doc.clinicId ? String(doc.clinicId) : undefined,
      }
    : { exists: false };
  // a doctor waiting for PMDC approval is re-checked every time, so approval takes effect at once
  if (value.verified !== false) statusCache.set(key, { at: Date.now(), value });
  return value;
};
const forgetAccountStatus = (role, subject) => statusCache.delete(`${role}:${subject}`);

// Verifies the Bearer token and sets req.user = { role, cnic | id, guardian?, verified?, clinicId? }
const requireAuth = async (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: 'Please sign in first' });
  }
  let claims;
  try {
    claims = jwt.verify(token, jwt_secret);
  } catch (error) {
    return res.status(401).json({ error: 'Session expired, please sign in again' });
  }
  const { role, cnic, id, guardian, iat } = claims;
  try {
    const status = await accountStatus(role, cnic ?? id);
    // tokens are timestamped in whole seconds; anything issued before the password change is refused
    if (!status.exists || status.changedAtMs > iat * 1000) {
      return res.status(401).json({ error: 'Session expired, please sign in again' });
    }
    if (status.disabled) {
      return res.status(403).json({ error: 'This account has been suspended.', code: 'ACCOUNT_DISABLED' });
    }
    req.user = { role, cnic, id, guardian, verified: status.verified, clinicId: status.clinicId };
    next();
  } catch (error) {
    next(error);
  }
};

const requireRole = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({ error: 'Not allowed' });
  }
  next();
};

// The signed-in user must be the patient (or doctor) named in the URL
const requireSelf = (role, param) => (req, res, next) => {
  if (req.user.role !== role || req.user.cnic !== Number(req.params[param])) {
    return res.status(403).json({ error: 'Not allowed' });
  }
  next();
};

// Doctors must be PMDC-verified before they can see patient data
const requireVerifiedDoctor = (req, res, next) => {
  if (req.user.role === 'doctor' && !req.user.verified) {
    return res.status(403).json({ error: 'Your PMDC registration has not been verified yet.', code: 'DOCTOR_NOT_VERIFIED' });
  }
  next();
};

// The patient themselves, or a verified doctor the patient is affiliated with (logged for the patient)
const requirePatientAccess = (param) => async (req, res, next) => {
  try {
    const patientCNIC = Number(req.params[param]);
    if (req.user.role === 'patient' && req.user.cnic === patientCNIC) {
      return next();
    }
    if (req.user.role === 'doctor' && req.user.verified) {
      const affiliation = await Affiliation.findOne({ patientCNIC, doctorCNIC: req.user.cnic });
      if (affiliation) {
        logAccess(patientCNIC, { role: 'doctor', cnic: req.user.cnic }, actionFor(req), req.ip);
        return next();
      }
    }
    return res.status(403).json({ error: 'Not allowed' });
  } catch (error) {
    console.error('Error checking patient access:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  signToken, requireAuth, requireRole, requireSelf, requirePatientAccess, requireVerifiedDoctor, forgetAccountStatus,
};
