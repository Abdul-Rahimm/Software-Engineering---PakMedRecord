// Shared account logic for doctors and patients: email verification and lookups.

const crypto = require('crypto');
const Doctor = require('../models/DoctorModel');
const Patient = require('../models/PatientModel');
const { mailEnabled, sendMail, verificationEmail } = require('./mailer');

const ROLES = {
  doctor: { Model: Doctor, cnicKey: 'doctorCNIC' },
  patient: { Model: Patient, cnicKey: 'patientCNIC' },
};

const APP_URL = () => (process.env.APP_URL || 'http://localhost:5173').replace(/\/$/, '');
const VERIFY_TTL_MS = 24 * 60 * 60 * 1000;

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const emailQuery = (email) => ({ email: new RegExp(`^${escapeRegex(String(email).trim())}$`, 'i') });

// Marks a new account unverified and emails a link. Without Gmail configured,
// the account is verified straight away so sign-up still works (logged as a warning).
const startEmailVerification = async (user, role) => {
  if (!mailEnabled()) {
    user.emailVerified = true;
    await user.save();
    console.warn(`Email verification skipped for ${user.email}: Gmail API is not configured.`);
    return { required: false, sent: false };
  }
  const token = crypto.randomBytes(32).toString('hex');
  user.emailVerified = false;
  user.emailVerifyTokenHash = hashToken(token);
  user.emailVerifyExpires = new Date(Date.now() + VERIFY_TTL_MS);
  await user.save();

  const link = `${APP_URL()}/verify-email?role=${role}&token=${token}`;
  try {
    await sendMail({ to: user.email, ...verificationEmail({ name: user.firstName, link }) });
    return { required: true, sent: true };
  } catch (err) {
    console.error('Failed to send verification email:', err.message);
    return { required: true, sent: false };
  }
};

module.exports = { ROLES, hashToken, emailQuery, startEmailVerification };
