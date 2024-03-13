const bcrypt = require('bcrypt');
const Patient = require('../models/PatientModel');
const Doctor = require('../models/DoctorModel');
const expressAsyncHandler = require('express-async-handler');

const Signup = expressAsyncHandler(async (req, res) => {
    const { cnic, firstName, lastName, email, hospital, gender, password } = req.body;

    try {
      const doctorWithSameCNIC = await Doctor.findOne({ cnic });
      if (doctorWithSameCNIC) {
        return res.status(409).json({ error: 'CNIC already registered as a doctor!' });
    }
        const existingPatient = await Patient.findOne({ cnic });
        if (existingPatient) {
            return res.status(409).json({ error: 'Patient already registered!' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const newPatient = new Patient({
            cnic,
            firstName,
            lastName,
            email,
            hospital,
            gender,
            password: hashedPassword
        });

        await newPatient.save();

        res.status(201).json({ message: 'Patient Signup successful' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

const Signin = expressAsyncHandler(async (req, res) => {
    const { cnic, password } = req.body;

    if (!cnic || !password) {
        return res.status(400).json({ error: 'All fields are required' });
    }

    try {
        const patient = await Patient.findOne({ cnic });

        if (!patient) {
            return res.status(401).json({ error: 'Authentication failed' });
        }

        const passwordMatch = await bcrypt.compare(password, patient.password);

        if (!passwordMatch) {
            return res.status(401).json({ error: 'Authentication failed' });
        }

        res.status(200).json({ message: 'Patient Signin successful', patient });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

const getPatient = expressAsyncHandler(async (req, res) => {
    try {
      const { cnic } = req.params; // Access the doctor ID from URL parameters
      console.log('Fetching patient with cnic:', cnic);
  
      // Validate that id is a valid ObjectId (assuming you're using MongoDB)
    
      const patient = await Patient.findOne({cnic: cnic});
  
      if (patient !== null) {
        res.status(200).json(patient);
        console.log({ message: 'Successfully fetched!', patient });
      } else {
        res.status(404).json({ message: 'Patient not found' });
      }
    } catch (error) {
      console.error('Error fetching patient data:', error);
      res.status(500).json({ message: 'Internal Server Error' });
    }
  });

module.exports = { Signup, Signin, getPatient };
