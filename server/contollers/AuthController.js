const jwt = require('jsonwebtoken');
const expressAsyncHandler = require('express-async-handler');
const Doctor = require('../models/DoctorModel');
const Patient = require('../models/PatientModel');
const { jwt_secret } = require('../config');
const { signToken } = require('../middleware/auth');
const bcrypt = require('bcrypt');
const { ROLES, TERMS_VERSION, hashToken, emailQuery, startEmailVerification, startPasswordReset } = require('../lib/accounts');
const { completeSignIn, verifySecondFactor } = require('../lib/session');
const { forgetAccountStatus } = require('../middleware/auth');
const { channels } = require('../lib/messaging');
const { testModeEnabled } = require('../lib/payments');
const { mailEnabled } = require('../lib/mailer');
const { googleEnabled, verifyGoogleIdToken } = require('../lib/firebase');
const { isCNIC } = require('../lib/validate');
const { SPECIALIZATIONS } = require('../models/constants');

const roleOf = (role) => ROLES[role] || null;

// Which sign-in options the frontend should show
const options = (req, res) => res.status(200).json({
  emailVerification: mailEnabled(),
  passwordReset: mailEnabled(),
  google: googleEnabled(),
  channels: channels(),
  // online payment depends on each clinic's own Safepay account; this only says whether demo payments are on
  payments: testModeEnabled() ? ['test'] : [],
  termsVersion: TERMS_VERSION,
});

// GET-style link from the email lands on the frontend, which posts { role, token } here
const verifyEmail = expressAsyncHandler(async (req, res) => {
  const { role, token } = req.body || {};
  const r = roleOf(role);
  if (!r || !token) return res.status(400).json({ error: 'Invalid verification link' });

  const user = await r.Model.findOne({ emailVerifyTokenHash: hashToken(String(token)) }).select('+emailVerifyExpires');
  if (!user) return res.status(400).json({ error: 'This link is invalid or was already used.', code: 'INVALID_TOKEN' });
  if (user.emailVerifyExpires < new Date()) {
    return res.status(400).json({ error: 'This link has expired. Sign in to get a new one.', code: 'EXPIRED_TOKEN' });
  }
  user.emailVerified = true;
  user.emailVerifyTokenHash = undefined;
  user.emailVerifyExpires = undefined;
  await user.save();
  res.status(200).json({ message: 'Email verified. You can sign in now.', cnic: user[r.cnicKey] });
});

// Re-send the link; the same generic answer either way so it can't be used to probe accounts
const resendVerification = expressAsyncHandler(async (req, res) => {
  const { role, cnic } = req.body || {};
  const r = roleOf(role);
  if (!r || !isCNIC(cnic)) return res.status(400).json({ error: 'Enter a valid CNIC' });
  const user = await r.Model.findOne({ [r.cnicKey]: Number(cnic) });
  if (user && user.emailVerified === false) await startEmailVerification(user, role);
  res.status(200).json({ message: 'If that account needs verifying, a new email is on its way.' });
});

// Sign in with Google: existing account -> session; new person -> short-lived registration ticket
const googleSignIn = expressAsyncHandler(async (req, res) => {
  if (!googleEnabled()) return res.status(503).json({ error: 'Google sign-in is not configured.' });
  const { role, idToken } = req.body || {};
  const r = roleOf(role);
  if (!r || !idToken) return res.status(400).json({ error: 'Missing role or Google token' });

  let google;
  try {
    google = await verifyGoogleIdToken(idToken);
  } catch (err) {
    return res.status(401).json({ error: 'Google sign-in failed. Please try again.' });
  }

  const user = (await r.Model.findOne({ googleUid: google.uid })) || (await r.Model.findOne(emailQuery(google.email)));
  if (user) {
    if (!user.googleUid) user.googleUid = google.uid;
    user.emailVerified = true; // Google has verified this address
    await user.save();
    const { status, body } = completeSignIn(role, user, 'Signed in with Google');
    return res.status(status).json(body);
  }

  const [firstName = '', ...rest] = google.name.split(' ');
  const ticket = jwt.sign({ purpose: 'google-register', role, uid: google.uid, email: google.email }, jwt_secret, { expiresIn: '30m' });
  res.status(200).json({ needsRegistration: true, ticket, profile: { email: google.email, firstName, lastName: rest.join(' ') } });
});

// Finish creating an account for a first-time Google user
const googleComplete = expressAsyncHandler(async (req, res) => {
  const { ticket, cnic, firstName, lastName, hospital, gender, specialization, acceptTerms } = req.body || {};
  let claims;
  try {
    claims = jwt.verify(String(ticket || ''), jwt_secret);
    if (claims.purpose !== 'google-register') throw new Error('wrong purpose');
  } catch {
    return res.status(401).json({ error: 'Your Google sign-in expired. Please continue with Google again.' });
  }
  const r = roleOf(claims.role);
  if (!isCNIC(cnic)) return res.status(400).json({ error: 'CNIC must be 13 digits' });
  if (!String(firstName || '').trim() || !String(lastName || '').trim() || !String(hospital || '').trim()) {
    return res.status(400).json({ error: 'Name and hospital are required' });
  }
  if (!acceptTerms) return res.status(400).json({ error: 'Please accept the Terms of Service and Privacy Policy' });
  if (claims.role === 'patient' && !['Male', 'Female', 'Other'].includes(gender)) return res.status(400).json({ error: 'Select a gender' });
  if (claims.role === 'doctor' && specialization && !SPECIALIZATIONS.includes(specialization)) return res.status(400).json({ error: 'Unknown specialization' });

  const n = Number(cnic);
  if ((await Doctor.findOne({ doctorCNIC: n })) || (await Patient.findOne({ patientCNIC: n }))) {
    return res.status(409).json({ error: 'This CNIC is already registered. Sign in with your password, then use Google next time.' });
  }
  if (await r.Model.findOne({ $or: [{ googleUid: claims.uid }, emailQuery(claims.email)] })) {
    return res.status(409).json({ error: 'An account with this Google email already exists. Continue with Google to sign in.' });
  }

  const user = await r.Model.create({
    [r.cnicKey]: n,
    firstName: String(firstName).trim(),
    lastName: String(lastName).trim(),
    email: claims.email,
    hospital: String(hospital).trim(),
    ...(claims.role === 'patient' ? { gender } : { specialization: specialization || 'General Physician', verification: { status: 'unverified' } }),
    googleUid: claims.uid,
    emailVerified: true,
    consentAt: new Date(),
    termsVersion: TERMS_VERSION,
  });
  res.status(201).json({ message: 'Account created with Google', token: signToken(claims.role, user[r.cnicKey]), [claims.role]: user });
});

// Forgot password: CNIC or email; always the same answer so it can't be used to find accounts
const forgotPassword = expressAsyncHandler(async (req, res) => {
  const { role, identifier } = req.body || {};
  const r = roleOf(role);
  const id = String(identifier || '').trim();
  if (!r || !id) return res.status(400).json({ error: 'Enter your CNIC or email' });
  if (!mailEnabled()) return res.status(503).json({ error: 'Password reset by email is not available right now. Contact support.' });
  const digits = id.replace(/\D/g, '');
  const user = isCNIC(digits) && !id.includes('@')
    ? await r.Model.findOne({ [r.cnicKey]: Number(digits) })
    : await r.Model.findOne(emailQuery(id));
  if (user && !user.disabled && user.email) {
    try {
      await startPasswordReset(user, role);
    } catch (err) {
      console.error('Failed to send reset email:', err.message);
    }
  }
  res.status(200).json({ message: 'If an account matches, we have emailed a link to reset the password. Check your inbox.' });
});

const resetPassword = expressAsyncHandler(async (req, res) => {
  const { role, token, password } = req.body || {};
  const r = roleOf(role);
  if (!r || !token) return res.status(400).json({ error: 'Invalid reset link' });
  if (String(password || '').length < 8) return res.status(400).json({ error: 'Use at least 8 characters' });
  const user = await r.Model.findOne({ passwordResetTokenHash: hashToken(String(token)) }).select('+passwordResetExpires');
  if (!user || user.passwordResetExpires < new Date()) {
    return res.status(400).json({ error: 'This link is invalid or has expired. Ask for a new one.', code: 'INVALID_TOKEN' });
  }
  user.password = await bcrypt.hash(String(password), 10);
  user.passwordResetTokenHash = undefined;
  user.passwordResetExpires = undefined;
  user.passwordChangedAt = new Date();
  // they proved they own the email
  if (user.emailVerified === false) user.emailVerified = true;
  await user.save();
  forgetAccountStatus(role, user[r.cnicKey]);
  res.status(200).json({ message: 'Password changed. Sign in with your new password.', cnic: user[r.cnicKey] });
});

// Second sign-in step for accounts with an authenticator app
const twoFactor = expressAsyncHandler(async (req, res) => {
  const { challenge, code } = req.body || {};
  const { status, body } = await verifySecondFactor(challenge, code);
  res.status(status).json(body);
});

module.exports = { options, verifyEmail, resendVerification, googleSignIn, googleComplete, forgotPassword, resetPassword, twoFactor };
