// Family profiles: a guardian manages children's or elderly parents' records under their own login.
// Switching to a dependent issues a session for that profile carrying { guardian }.

const bcrypt = require('bcrypt');
const expressAsyncHandler = require('express-async-handler');
const Patient = require('../models/PatientModel');
const Doctor = require('../models/DoctorModel');
const { signToken } = require('../middleware/auth');
const { cnicProblem, isCNIC, isEmail } = require('../lib/validate');
const { purgePatient } = require('./AccountController');
const { startEmailVerification, TERMS_VERSION } = require('../lib/accounts');

// The guardian's own CNIC, whether they're currently acting as themselves or for a dependent
const guardianOf = (req) => req.user.guardian || req.user.cnic;

const loadDependent = async (req, res) => {
  const dep = await Patient.findOne({ patientCNIC: Number(req.params.cnic), guardianCNIC: guardianOf(req) });
  if (!dep) res.status(404).json({ error: 'Family member not found' });
  return dep;
};

const list = expressAsyncHandler(async (req, res) => {
  const guardian = guardianOf(req);
  const [me, dependents] = await Promise.all([
    Patient.findOne({ patientCNIC: guardian }).select('patientCNIC firstName lastName gender dateOfBirth'),
    Patient.find({ guardianCNIC: guardian }).select('patientCNIC firstName lastName gender dateOfBirth relation bloodGroup email').sort({ dateOfBirth: -1 }),
  ]);
  res.status(200).json({ guardian: me, dependents, actingFor: req.user.guardian ? req.user.cnic : null });
});

// { cnic (B-Form/CNIC), firstName, lastName, gender, dateOfBirth, relation }
const add = expressAsyncHandler(async (req, res) => {
  if (req.user.guardian) return res.status(403).json({ error: 'Switch back to your own profile to add family members.' });
  const { cnic, firstName, lastName, gender, dateOfBirth, relation } = req.body || {};
  if (!isCNIC(cnic)) return res.status(400).json({ error: 'Enter the 13-digit B-Form or CNIC number' });
  if (!String(firstName || '').trim() || !String(lastName || '').trim()) return res.status(400).json({ error: 'Enter their name' });
  if (!['Male', 'Female', 'Other'].includes(gender)) return res.status(400).json({ error: 'Select a gender' });
  const cnicError = cnicProblem(cnic, gender);
  if (cnicError) return res.status(400).json({ error: cnicError.replace('CNIC', 'B-Form/CNIC') });
  const dob = dateOfBirth ? new Date(dateOfBirth) : null;
  if (!dob || Number.isNaN(dob.getTime()) || dob > new Date()) return res.status(400).json({ error: 'Enter a valid date of birth' });
  const n = Number(cnic);
  if (n === req.user.cnic || (await Patient.exists({ patientCNIC: n }))) {
    return res.status(409).json({ error: 'This B-Form/CNIC is already registered.' });
  }
  if ((await Patient.countDocuments({ guardianCNIC: req.user.cnic })) >= 10) return res.status(400).json({ error: 'You can manage up to 10 family members' });
  const guardian = await Patient.findOne({ patientCNIC: req.user.cnic });
  const dependent = await Patient.create({
    patientCNIC: n,
    firstName: String(firstName).trim(),
    lastName: String(lastName).trim(),
    gender,
    dateOfBirth: dob,
    relation: String(relation || '').trim().slice(0, 40),
    guardianCNIC: req.user.cnic,
    hospital: guardian?.hospital,
    emergencyContact: guardian ? { name: `${guardian.firstName} ${guardian.lastName}`, relation: 'Guardian', phone: guardian.phone || '' } : undefined,
  });
  res.status(201).json({ message: 'Family member added', dependent });
});

// Session for the dependent (or back to the guardian with cnic = guardian)
const switchTo = expressAsyncHandler(async (req, res) => {
  const guardian = guardianOf(req);
  const target = Number(req.params.cnic);
  if (target === guardian) {
    const me = await Patient.findOne({ patientCNIC: guardian });
    return res.status(200).json({ token: signToken('patient', guardian), patient: me });
  }
  const dep = await loadDependent(req, res);
  if (!dep) return;
  res.status(200).json({ token: signToken('patient', dep.patientCNIC, { guardian }), patient: dep, guardian });
});

const remove = expressAsyncHandler(async (req, res) => {
  const dep = await loadDependent(req, res);
  if (!dep) return;
  if (req.user.cnic === dep.patientCNIC) return res.status(400).json({ error: 'Switch back to your own profile first' });
  await purgePatient(dep.patientCNIC);
  res.status(200).json({ message: 'Profile and its records deleted' });
});

// Give a grown-up dependent their own login (email + password); the profile then becomes independent
const handover = expressAsyncHandler(async (req, res) => {
  const dep = await loadDependent(req, res);
  if (!dep) return;
  const { email, password } = req.body || {};
  if (!isEmail(email)) return res.status(400).json({ error: 'Enter their email' });
  if (String(password || '').length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });
  dep.email = String(email).trim().toLowerCase();
  dep.password = await bcrypt.hash(String(password), 10);
  dep.guardianCNIC = undefined;
  dep.consentAt = new Date();
  dep.termsVersion = TERMS_VERSION;
  await dep.save();
  const verification = await startEmailVerification(dep, 'patient');
  res.status(200).json({ message: verification.required ? 'Login created. They need to verify their email before signing in.' : 'Login created. They can now sign in with their B-Form/CNIC.' });
});

module.exports = { list, add, switchTo, remove, handover };
