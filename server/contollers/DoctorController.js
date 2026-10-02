const bcrypt = require('bcrypt');
const Doctor = require('../models/DoctorModel');
const expressAsyncHandler = require('express-async-handler');
const Patient = require('../models/PatientModel');
const { signToken } = require('../middleware/auth');
const { startEmailVerification } = require('../lib/accounts');
const { isCNIC, isEmail } = require('../lib/validate');
const { SPECIALIZATIONS } = require('../models/constants');

const Signup = expressAsyncHandler(async (req, res) => {
  const { doctorCNIC, firstName, lastName, email, password, hospital, specialization } = req.body;

  if (!doctorCNIC || !firstName || !lastName || !email || !password || !hospital) {
    return res.status(400).json({ error: 'All fields are required' });
  }
  if (!isCNIC(doctorCNIC)) return res.status(400).json({ error: 'CNIC must be 13 digits' });
  if (!isEmail(email)) return res.status(400).json({ error: 'Enter a valid email' });
  if (String(password).length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
  if (specialization && !SPECIALIZATIONS.includes(specialization)) return res.status(400).json({ error: 'Unknown specialization' });

  try {
    const patientWithSameCNIC = await Patient.findOne({ patientCNIC: doctorCNIC });
      if (patientWithSameCNIC) {
        return res.status(409).json({ error: 'CNIC already registered as a patient!' });
    }

    const existingDoctor = await Doctor.findOne({ doctorCNIC });
    if (existingDoctor) {
      return res.status(409).json({ error: 'Doctor already registered!' });
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
    });

    await newDoctor.save();
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

    const token = signToken('doctor', doctor.doctorCNIC);
    res.status(200).json({ message: 'Signin successful', doctor, token });
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
    const filter = {};
    if (specialization) filter.specialization = specialization;
    if (q) {
      const rx = new RegExp(String(q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [{ firstName: rx }, { lastName: rx }, { hospital: rx }];
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

    const { firstName, lastName, email, hospital, specialization, phone, bio, yearsExperience, password } = req.body;
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

module.exports = { Signup, Signin, getDoctor, getAllDoctors, updateDoctor, getSpecializations };
