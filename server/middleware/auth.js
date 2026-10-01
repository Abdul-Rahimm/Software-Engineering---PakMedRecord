const jwt = require('jsonwebtoken');
const { jwt_secret } = require('../config');
const Affiliation = require('../models/AffiliationModel');

const signToken = (role, cnic) => jwt.sign({ role, cnic: Number(cnic) }, jwt_secret, { expiresIn: '8h' });

// Verifies the Bearer token and sets req.user = { role: 'doctor' | 'patient', cnic }
const requireAuth = (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: 'Please sign in first' });
  }
  try {
    const { role, cnic } = jwt.verify(token, jwt_secret);
    req.user = { role, cnic };
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Session expired, please sign in again' });
  }
};

const requireRole = (role) => (req, res, next) => {
  if (req.user.role !== role) {
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

// The patient themselves, or a doctor the patient is affiliated with
const requirePatientAccess = (param) => async (req, res, next) => {
  try {
    const patientCNIC = Number(req.params[param]);
    if (req.user.role === 'patient' && req.user.cnic === patientCNIC) {
      return next();
    }
    if (req.user.role === 'doctor') {
      const affiliation = await Affiliation.findOne({ patientCNIC, doctorCNIC: req.user.cnic });
      if (affiliation) {
        return next();
      }
    }
    return res.status(403).json({ error: 'Not allowed' });
  } catch (error) {
    console.error('Error checking patient access:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = { signToken, requireAuth, requireRole, requireSelf, requirePatientAccess };
