const bcrypt = require('bcrypt');
const Doctor = require('../models/DoctorModel');
const expressAsyncHandler = require('express-async-handler');
const Patient = require('../models/PatientModel');
const { completeSignIn } = require('../lib/session');
const { TERMS_VERSION } = require('../lib/accounts');
const { saveFile, openFileStream, deleteFile } = require('../lib/files');
const { cleanSchedule, scheduleOf } = require('../lib/availability');
const { scheduleClash } = require('../lib/conflicts');
const { forgetAccountStatus } = require('../middleware/auth');
const { startEmailVerification } = require('../lib/accounts');
const { signupCapture, recordSignupIdentity, dropCapture } = require('./IdentityController');
const { cnicProblem, isCNIC, isEmail, cleanList } = require('../lib/validate');
const { SPECIALIZATIONS } = require('../models/constants');

const Signup = expressAsyncHandler(async (req, res) => {
  const { doctorCNIC, firstName, lastName, email, password, hospital, specialization, acceptTerms } = req.body;

  if (!doctorCNIC || !firstName || !lastName || !email || !password || !hospital) {
    return res.status(400).json({ error: 'All fields are required' });
  }
  const cnicError = cnicProblem(doctorCNIC);
  if (cnicError) return res.status(400).json({ error: cnicError });
  if (!isEmail(email)) return res.status(400).json({ error: 'Enter a valid email' });
  if (String(password).length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
  if (specialization && !SPECIALIZATIONS.includes(specialization)) return res.status(400).json({ error: 'Unknown specialization' });
  if (!acceptTerms) return res.status(400).json({ error: 'Please accept the Terms of Service and Privacy Policy' });

  try {
    const existingDoctor = await Doctor.findOne({ doctorCNIC });
    if (existingDoctor) {
      return res.status(409).json({ error: 'Doctor already registered!', code: 'CNIC_TAKEN' });
    }

    let capture;
    try {
      capture = await signupCapture(req.body, { cnic: doctorCNIC, role: 'doctor', userAgent: req.get('user-agent') });
    } catch (err) {
      return res.status(400).json({ error: err.message, code: 'IDENTITY_REQUIRED' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newDoctor = new Doctor({
      doctorCNIC,
      firstName,
      lastName,
      email: String(email).trim().toLowerCase(),
      password: hashedPassword,
      hospital,
      ...(specialization && { specialization }),
      verification: { status: 'unverified' },
      consentAt: new Date(),
      termsVersion: TERMS_VERSION,
    });

    try {
      await newDoctor.save();
    } catch (err) {
      dropCapture(capture);
      throw err;
    }
    await recordSignupIdentity({ role: 'doctor', account: newDoctor, cnic: doctorCNIC, name: `${firstName} ${lastName}`, capture, ip: req.ip });
    const verification = await startEmailVerification(newDoctor, 'doctor');

    res.status(201).json({
      message: verification.required ? 'Account created. Check your email to verify it.' : 'Signup successful',
      verificationRequired: verification.required,
      emailSent: verification.sent,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }

});

const Signin = expressAsyncHandler(async (req, res) => {
  const { doctorCNIC, password } = req.body;

  if (!doctorCNIC || !password ) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  try {
    const doctor = await Doctor.findOne({ doctorCNIC });

    if (!doctor) {
      return res.status(401).json({ error: 'Please Signup First!' });
    }
 
    if (!doctor.password) {
      return res.status(401).json({ error: 'This account uses Google sign-in. Choose "Continue with Google".' });
    }

    const passwordMatch = await bcrypt.compare(password, doctor.password);

    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (doctor.emailVerified === false) {
      return res.status(403).json({ error: 'Please verify your email first. Check your inbox for the link we sent when you signed up.', code: 'EMAIL_NOT_VERIFIED' });
    }

    const { status, body } = completeSignIn('doctor', doctor, 'Signin successful');
    res.status(status).json(body);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

const getDoctor = expressAsyncHandler(async (req, res) => {
  try {
    const { doctorCNIC } = req.params; // Access the doctor ID from URL parameters

    // Validate that id is a valid ObjectId (assuming you're using MongoDB)
  
    const doctor = await Doctor.findOne({doctorCNIC: doctorCNIC});

    if (doctor !== null) {
      res.status(200).json(doctor);
    } else {
      res.status(404).json({ message: 'Doctor not found' });
    }
  } catch (error) {
    console.error('Error fetching doctor data:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

const getAllDoctors = expressAsyncHandler(async (req, res) => {
  try {
    // Optional filters: ?q= name/hospital search, ?specialization=
    const { q, specialization } = req.query;
    const filter = { $or: [{ 'verification.status': { $exists: false } }, { 'verification.status': 'verified' }], disabled: { $ne: true } };
    if (specialization) filter.specialization = specialization;
    if (q) {
      const rx = new RegExp(String(q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$and = [{ $or: [{ firstName: rx }, { lastName: rx }, { hospital: rx }, { city: rx }] }];
    }
    const doctors = await Doctor.find(filter).sort({ firstName: 1 });

    // Check if any doctors were found
    res.status(200).json(doctors);
  } catch (error) {
    console.error('Error fetching doctors:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});


// Doctor edits their own professional profile
const updateDoctor = expressAsyncHandler(async (req, res) => {
  try {
    const doctor = await Doctor.findOne({ doctorCNIC: req.params.doctorCNIC });
    if (!doctor) return res.status(404).json({ error: 'Doctor not found' });

    const { firstName, lastName, email, hospital, specialization, phone, bio, yearsExperience, password, city, clinicAddress, fee, languages, qualifications, travelBufferMinutes } = req.body;
    if (email !== undefined && !isEmail(email)) return res.status(400).json({ error: 'Enter a valid email' });
    if (specialization !== undefined && !SPECIALIZATIONS.includes(specialization)) return res.status(400).json({ error: 'Unknown specialization' });
    if (password !== undefined && password !== '' && String(password).length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

    if (firstName) doctor.firstName = String(firstName).trim();
    if (lastName) doctor.lastName = String(lastName).trim();
    if (email) doctor.email = String(email).trim();
    if (hospital) doctor.hospital = String(hospital).trim();
    if (specialization) doctor.specialization = specialization;
    if (phone !== undefined) doctor.phone = String(phone).trim();
    if (bio !== undefined) doctor.bio = String(bio).trim();
    if (yearsExperience !== undefined && yearsExperience !== '') doctor.yearsExperience = Number(yearsExperience);
    if (password) doctor.password = await bcrypt.hash(password, 10);
    if (city !== undefined) doctor.city = String(city).trim();
    if (clinicAddress !== undefined) doctor.clinicAddress = String(clinicAddress).trim();
    if (fee !== undefined) doctor.fee = fee === '' || fee === null ? undefined : Number(fee);
    if (languages !== undefined) doctor.languages = cleanList(languages, 8);
    if (travelBufferMinutes !== undefined) doctor.travelBufferMinutes = Math.min(120, Math.max(0, Math.round(Number(travelBufferMinutes) || 0)));
    if (qualifications !== undefined) doctor.qualifications = String(qualifications).trim();

    await doctor.save();
    res.status(200).json({ message: 'Profile updated', doctor });
  } catch (error) {
    if (error.name === 'ValidationError') return res.status(400).json({ error: error.message });
    if (error.code === 11000) return res.status(409).json({ error: 'That email is already in use' });
    console.error('Error updating doctor:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

const getSpecializations = (req, res) => res.status(200).json(SPECIALIZATIONS);

const PDF_OR_IMAGE = (buf) => {
  if (buf.subarray(0, 5).toString('latin1') === '%PDF-') return 'application/pdf';
  if (buf[0] === 0x89 && buf.subarray(1, 4).toString('latin1') === 'PNG') return 'image/png';
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.subarray(0, 4).toString('latin1') === 'RIFF' && buf.subarray(8, 12).toString('latin1') === 'WEBP') return 'image/webp';
  return null;
};

// POST /doctor/:doctorCNIC/verification  raw file bytes (PMDC certificate), X-PMDC-Number + X-File-Name headers
const submitVerification = expressAsyncHandler(async (req, res) => {
  const doctor = await Doctor.findOne({ doctorCNIC: req.params.doctorCNIC });
  if (!doctor) return res.status(404).json({ error: 'Doctor not found' });
  if (doctor.isVerified) return res.status(409).json({ error: 'Your account is already verified' });
  const pmdcNumber = String(req.get('x-pmdc-number') || '').trim();
  if (!/^[A-Za-z0-9-/ ]{3,40}$/.test(pmdcNumber)) return res.status(400).json({ error: 'Enter your PMDC registration number' });
  const buffer = req.body;
  if (!Buffer.isBuffer(buffer) || !buffer.length) return res.status(400).json({ error: 'Attach a photo or PDF of your PMDC certificate' });
  if (buffer.length > 4 * 1024 * 1024) return res.status(413).json({ error: 'File is larger than 4 MB' });
  const mime = PDF_OR_IMAGE(buffer);
  if (!mime) return res.status(415).json({ error: 'Use a PDF, JPG, PNG or WebP file' });

  const name = decodeURIComponent(String(req.get('x-file-name') || 'pmdc-certificate')).replace(/[\r\n"]/g, '').slice(0, 200);
  if (doctor.verification?.document?.gridId) await deleteFile(doctor.verification.document.gridId);
  const gridId = await saveFile(buffer, { name, mime, metadata: { doctorCNIC: doctor.doctorCNIC, kind: 'pmdc' } });
  doctor.verification = { status: 'pending', pmdcNumber, document: { gridId, name, mime, size: buffer.length }, submittedAt: new Date() };
  await doctor.save();
  forgetAccountStatus('doctor', doctor.doctorCNIC);
  res.status(200).json({ message: 'Submitted for review. We usually verify within one working day.', doctor });
});

// The doctor's own uploaded certificate (admins have their own route)
const verificationDocument = expressAsyncHandler(async (req, res) => {
  const doctor = await Doctor.findOne({ doctorCNIC: req.params.doctorCNIC });
  const doc = doctor?.verification?.document;
  if (!doc?.gridId) return res.status(404).json({ error: 'No document uploaded' });
  res.set({ 'Content-Type': doc.mime, 'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(doc.name)}`, 'Cache-Control': 'private, no-store' });
  openFileStream(doc.gridId).on('error', () => !res.headersSent && res.status(404).end()).pipe(res);
});

// Weekly hours, slot length, holidays, video consults
const updateAvailability = expressAsyncHandler(async (req, res) => {
  const doctor = await Doctor.findOne({ doctorCNIC: req.params.doctorCNIC });
  if (!doctor) return res.status(404).json({ error: 'Doctor not found' });
  try {
    doctor.availability = cleanSchedule(req.body);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
  const clash = await scheduleClash(doctor, doctor.availability.days, 'private');
  if (clash) return res.status(400).json({ error: `These hours clash with your hours elsewhere: ${clash}` });
  await doctor.save();
  res.status(200).json({ message: 'Clinic hours saved', availability: scheduleOf(doctor) });
});

module.exports = {
  Signup, Signin, getDoctor, getAllDoctors, updateDoctor, getSpecializations, submitVerification, verificationDocument, updateAvailability,
};
