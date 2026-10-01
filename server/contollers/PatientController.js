const bcrypt = require('bcrypt');
const Patient = require('../models/PatientModel');
const Doctor = require('../models/DoctorModel');
const expressAsyncHandler = require('express-async-handler');
const { signToken } = require('../middleware/auth');

const Signup = expressAsyncHandler(async (req, res) => {
  const { patientCNIC, firstName, lastName, email, hospital, gender, password } = req.body;

  if (!patientCNIC || !firstName || !lastName || !email || !hospital || !gender || !password) {
    return res.status(400).json({ error: 'All fields are required' });
  }

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
      const { firstName, lastName, password, email } = req.body;
  
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
  
      // Save the updated patient
      await patient.save();
  
      res.status(200).json({ message: 'Patient information updated successfully' });
    } catch (error) {
      console.error('Error updating patient information:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });
  
  module.exports = { Signup, Signin, getPatient, updatePatient };
  