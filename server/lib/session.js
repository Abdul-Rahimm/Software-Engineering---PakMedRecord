// Finishing a sign-in: either a session token, or a two-step challenge when the account has 2FA on.

const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { jwt_secret } = require('../config');
const { signToken } = require('../middleware/auth');
const { verifyTotp } = require('./totp');
const Doctor = require('../models/DoctorModel');
const Patient = require('../models/PatientModel');
const Admin = require('../models/AdminModel');
const Staff = require('../models/StaffModel');

const MODELS = {
  doctor: { Model: Doctor, key: 'doctorCNIC' },
  patient: { Model: Patient, key: 'patientCNIC' },
  admin: { Model: Admin, key: '_id' },
  staff: { Model: Staff, key: '_id' },
};

const subjectOf = (role, user) => (MODELS[role].key === '_id' ? String(user._id) : user[MODELS[role].key]);

// { status, body } for a user who has proven who they are (password or Google)
const completeSignIn = (role, user, message) => {
  if (user.disabled) {
    return { status: 403, body: { error: 'This account has been suspended. Contact support if you think this is a mistake.', code: 'ACCOUNT_DISABLED' } };
  }
  if (user.twoFactor?.enabled) {
    const challenge = jwt.sign({ purpose: '2fa', role, sub: String(subjectOf(role, user)) }, jwt_secret, { expiresIn: '5m' });
    return { status: 200, body: { twoFactorRequired: true, challenge, message: 'Enter the 6-digit code from your authenticator app' } };
  }
  return { status: 200, body: { message, token: signToken(role, subjectOf(role, user)), [role]: user } };
};

const findBySubject = (role, sub) => {
  const { Model, key } = MODELS[role];
  return Model.findOne({ [key]: key === '_id' ? sub : Number(sub) });
};

// Second step: TOTP code or a one-time recovery code
const verifySecondFactor = async (challenge, code) => {
  let claims;
  try {
    claims = jwt.verify(String(challenge || ''), jwt_secret);
    if (claims.purpose !== '2fa' || !MODELS[claims.role]) throw new Error('bad challenge');
  } catch {
    return { status: 401, body: { error: 'Your sign-in expired. Please start again.' } };
  }
  const user = await findBySubject(claims.role, claims.sub).select('+twoFactor.secret +twoFactor.recoveryHashes');
  if (!user || !user.twoFactor?.enabled) return { status: 401, body: { error: 'Please sign in again.' } };

  let ok = verifyTotp(user.twoFactor.secret, code);
  if (!ok) {
    const clean = String(code || '').trim().toLowerCase();
    const idx = await (async () => {
      for (let i = 0; i < (user.twoFactor.recoveryHashes || []).length; i++) {
        if (await bcrypt.compare(clean, user.twoFactor.recoveryHashes[i])) return i;
      }
      return -1;
    })();
    if (idx >= 0) {
      user.twoFactor.recoveryHashes.splice(idx, 1);
      await user.save();
      ok = true;
    }
  }
  if (!ok) return { status: 401, body: { error: 'That code is not right. Check your authenticator app and try again.' } };
  const role = claims.role;
  return { status: 200, body: { message: 'Signed in', token: signToken(role, subjectOf(role, user)), [role]: user } };
};

const newRecoveryCodes = () =>
  Array.from({ length: 8 }, () => crypto.randomBytes(5).toString('hex').replace(/(.{5})/, '$1-'));

module.exports = { MODELS, completeSignIn, verifySecondFactor, findBySubject, newRecoveryCodes, subjectOf };
