const bcrypt = require('bcrypt');
const Patient = require('../models/PatientModel');
const Doctor = require('../models/DoctorModel');
const expressAsyncHandler = require('express-async-handler');
const { completeSignIn } = require('../lib/session');
const { startEmailVerification, TERMS_VERSION } = require('../lib/accounts');
const { isCNIC, isEmail, cleanList } = require('../lib/validate');
const { BLOOD_GROUPS } = require('../models/constants');
const { timesFor } = require('./PrescriptionController');

const Signup = expressAsyncHandler(async (req, res) => {
  const { patientCNIC, firstName, lastName, email, hospital, gender, password, acceptTerms } = req.body;

  if (!patientCNIC || !firstName || !lastName || !email || !hospital || !gender || !password) {
    return res.status(400).json({ error: 'All fields are required' });
  }
  if (!isCNIC(patientCNIC)) return res.status(400).json({ error: 'CNIC must be 13 digits' });
  if (!isEmail(email)) return res.status(400).json({ error: 'Enter a valid email' });
  if (String(password).length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
  if (!['Male', 'Female', 'Other'].includes(gender)) return res.status(400).json({ error: 'Select a gender' });
  if (!acceptTerms) return res.status(400).json({ error: 'Please accept the Terms of Service and Privacy Policy' });

  try {
    const doctorWithSameCNIC = await Doctor.findOne({ doctorCNIC: patientCNIC });
    if (doctorWithSameCNIC) {
      return res.status(409).json({ error: 'CNIC already registered as a doctor!' });
    }

    const existingPatient = await Patient.findOne({ patientCNIC });
    if (existingPatient) {
      return res.status(409).json({ error: 'Patient already registered!' });
    }

    const newPatient = new Patient({
      patientCNIC,
      firstName,
      lastName,
      email: String(email).trim().toLowerCase(),
      hospital,
      gender,
      password: await bcrypt.hash(password, 10),
      consentAt: new Date(),
      termsVersion: TERMS_VERSION,
    });

    await newPatient.save();
    const verification = await startEmailVerification(newPatient, 'patient');

    res.status(201).json({
      message: verification.required ? 'Account created. Check your email to verify it.' : 'Patient Signup successful',
      verificationRequired: verification.required,
      emailSent: verification.sent,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});


const Signin = expressAsyncHandler(async (req, res) => {
    const { patientCNIC, password } = req.body;

    if (!patientCNIC || !password) {
        return res.status(400).json({ error: 'All fields are required' });
    }

    try {
        const patient = await Patient.findOne({ patientCNIC });

        if (!patient) {
            return res.status(401).json({ error: 'Authentication failed' });
        }

        if (!patient.password && patient.guardianCNIC) {
            return res.status(401).json({ error: 'This profile is managed by a family member. Ask them to give you your own login from their Family page.' });
        }

        if (!patient.password) {
            return res.status(401).json({ error: 'This account uses Google sign-in. Choose "Continue with Google".' });
        }

        const passwordMatch = await bcrypt.compare(password, patient.password);

        if (!passwordMatch) {
            return res.status(401).json({ error: 'Authentication failed' });
        }

        if (patient.emailVerified === false) {
            return res.status(403).json({ error: 'Please verify your email first. Check your inbox for the link we sent when you signed up.', code: 'EMAIL_NOT_VERIFIED' });
        }

        const { status, body } = completeSignIn('patient', patient, 'Patient Signin successful');
        res.status(status).json(body);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

const getPatient = expressAsyncHandler(async (req, res) => {
    try {
      const { patientCNIC } = req.params; // Access the doctor ID from URL parameters
  
      // Validate that id is a valid ObjectId (assuming you're using MongoDB)
    
      const patient = await Patient.findOne({patientCNIC: patientCNIC});
  
      if (patient !== null) {
        res.status(200).json(patient);
      } else {
        res.status(404).json({ message: 'Patient not found' });
      }
    } catch (error) {
      console.error('Error fetching patient data:', error);
      res.status(500).json({ message: 'Internal Server Error' });
    }
  });

  const updatePatient = expressAsyncHandler(async (req, res) => {
    try {
      const { patientCNIC } = req.params;
      const { firstName, lastName, password, email, phone, notificationPrefs } = req.body;
      if (email !== undefined && email !== '' && !isEmail(email)) return res.status(400).json({ error: 'Enter a valid email' });
      if (password && String(password).length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
  
      // Find the patient by CNIC
      const patient = await Patient.findOne({ patientCNIC });
  
      if (!patient) {
        return res.status(404).json({ error: 'Patient not found' });
      }
  
      // Update patient information
      if (firstName) patient.firstName = firstName;
      if (lastName) patient.lastName = lastName;
      if (password) patient.password = await bcrypt.hash(password, 10);
      if (email) patient.email = email;
      if (phone !== undefined) patient.phone = String(phone).trim();
      if (notificationPrefs && typeof notificationPrefs === 'object') {
        for (const k of ['email', 'whatsapp', 'sms', 'appointmentReminders', 'medicationReminders']) {
          if (typeof notificationPrefs[k] === 'boolean') patient.notificationPrefs[k] = notificationPrefs[k];
        }
      }
  
      // Save the updated patient
      await patient.save();
  
      res.status(200).json({ message: 'Patient information updated successfully', patient });
    } catch (error) {
      console.error('Error updating patient information:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });
  
  const validDate = (v) => {
    if (!v) return undefined;
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? undefined : d;
  };

  // Patient maintains their medical profile (allergies, medications, emergency contact…)
  const updateHealth = expressAsyncHandler(async (req, res) => {
    try {
      const patient = await Patient.findOne({ patientCNIC: req.params.patientCNIC });
      if (!patient) return res.status(404).json({ error: 'Patient not found' });

      const b = req.body;
      if (b.bloodGroup !== undefined) {
        if (b.bloodGroup && !BLOOD_GROUPS.includes(b.bloodGroup)) return res.status(400).json({ error: 'Unknown blood group' });
        patient.bloodGroup = b.bloodGroup;
      }
      if (b.dateOfBirth !== undefined) {
        const dob = b.dateOfBirth ? new Date(b.dateOfBirth) : undefined;
        if (dob && (Number.isNaN(dob.getTime()) || dob > new Date())) return res.status(400).json({ error: 'Enter a valid date of birth' });
        patient.dateOfBirth = dob;
      }
      for (const key of ['heightCm', 'weightKg']) {
        if (b[key] !== undefined) patient[key] = b[key] === '' || b[key] === null ? undefined : Number(b[key]);
      }
      for (const key of ['allergies', 'chronicConditions', 'familyHistory']) {
        if (b[key] !== undefined) patient[key] = cleanList(b[key]);
      }
      if (b.medications !== undefined) {
        patient.medications = (Array.isArray(b.medications) ? b.medications : [])
          .filter((m) => m && String(m.name || '').trim())
          .slice(0, 40)
          .map((m) => ({
            name: String(m.name).trim(),
            dose: String(m.dose || '').trim(),
            frequency: String(m.frequency || '').trim(),
            // new medicines get dose times from "twice daily" etc.; an explicit list (even empty) is kept
            times: m.times === undefined ? timesFor(m.frequency) : [...new Set((Array.isArray(m.times) ? m.times : []).filter((t) => /^([01]\d|2[0-3]):[0-5]\d$/.test(t)))].sort().slice(0, 6),
            startDate: validDate(m.startDate),
            endDate: validDate(m.endDate),
            refillDate: validDate(m.refillDate),
            prescriptionCode: m.prescriptionCode ? String(m.prescriptionCode).slice(0, 20) : undefined,
          }));
      }
      if (b.vaccinations !== undefined) {
        patient.vaccinations = (Array.isArray(b.vaccinations) ? b.vaccinations : [])
          .filter((v) => v && String(v.name || '').trim())
          .slice(0, 60)
          .map((v) => ({ name: String(v.name).trim(), dose: String(v.dose || '').trim(), date: validDate(v.date), code: v.code ? String(v.code).slice(0, 20) : undefined }));
      }
      if (b.emergencyContact !== undefined) {
        const ec = b.emergencyContact || {};
        patient.emergencyContact = { name: String(ec.name || '').trim(), relation: String(ec.relation || '').trim(), phone: String(ec.phone || '').trim() };
      }

      await patient.save();
      res.status(200).json({ message: 'Health profile updated', patient });
    } catch (error) {
      if (error.name === 'ValidationError' || error.name === 'CastError') return res.status(400).json({ error: error.message });
      console.error('Error updating health profile:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  module.exports = { Signup, Signin, getPatient, updatePatient, updateHealth };
  