const bcrypt = require('bcrypt');
const Patient = require('../models/PatientModel');
const Doctor = require('../models/DoctorModel');
const expressAsyncHandler = require('express-async-handler');
const { signToken } = require('../middleware/auth');
const { isCNIC, isEmail, cleanList } = require('../lib/validate');
const { BLOOD_GROUPS } = require('../models/constants');

const Signup = expressAsyncHandler(async (req, res) => {
  const { patientCNIC, firstName, lastName, email, hospital, gender, password } = req.body;

  if (!patientCNIC || !firstName || !lastName || !email || !hospital || !gender || !password) {
    return res.status(400).json({ error: 'All fields are required' });
  }
  if (!isCNIC(patientCNIC)) return res.status(400).json({ error: 'CNIC must be 13 digits' });
  if (!isEmail(email)) return res.status(400).json({ error: 'Enter a valid email' });
  if (String(password).length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
  if (!['Male', 'Female', 'Other'].includes(gender)) return res.status(400).json({ error: 'Select a gender' });

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
      email,
      hospital,
      gender,
      password: await bcrypt.hash(password, 10),
    });

    await newPatient.save();

    res.status(201).json({ message: 'Patient Signup successful' });
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

        const passwordMatch = await bcrypt.compare(password, patient.password);

        if (!passwordMatch) {
            return res.status(401).json({ error: 'Authentication failed' });
        }

        const token = signToken('patient', patient.patientCNIC);
        res.status(200).json({ message: 'Patient Signin successful', patient, token });
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
      const { firstName, lastName, password, email, phone } = req.body;
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
  
      // Save the updated patient
      await patient.save();
  
      res.status(200).json({ message: 'Patient information updated successfully' });
    } catch (error) {
      console.error('Error updating patient information:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });
  
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
          .map((m) => ({ name: String(m.name).trim(), dose: String(m.dose || '').trim(), frequency: String(m.frequency || '').trim() }));
      }
      if (b.vaccinations !== undefined) {
        patient.vaccinations = (Array.isArray(b.vaccinations) ? b.vaccinations : [])
          .filter((v) => v && String(v.name || '').trim())
          .slice(0, 60)
          .map((v) => ({ name: String(v.name).trim(), dose: String(v.dose || '').trim(), date: v.date ? new Date(v.date) : undefined }));
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
  