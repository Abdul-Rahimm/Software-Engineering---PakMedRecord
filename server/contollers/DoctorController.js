const bcrypt = require('bcrypt');
const Doctor = require('../models/DoctorModel');
const expressAsyncHandler = require('express-async-handler');
const Patient = require('../models/PatientModel');

const Signup = expressAsyncHandler(async (req, res) => {
  const { cnic, firstName, lastName, email, password, hospital } = req.body;

  try {
    const patientWithSameCNIC = await Patient.findOne({ cnic });
      if (patientWithSameCNIC) {
        return res.status(409).json({ error: 'CNIC already registered as a patient!' });
    }

    const existingDoctor = await Doctor.findOne({ cnic });
    if (existingDoctor) {
      return res.status(409).json({ error: 'Doctor already registered!' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newDoctor = new Doctor({
      cnic,
      firstName,
      lastName,
      email,
      password: hashedPassword,
      hospital
    });

    await newDoctor.save();

    res.status(201).json({ message: 'Signup successful' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }

});

const Signin = expressAsyncHandler(async (req, res) => {
  const { cnic, password } = req.body;

  if (!cnic || !password ) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  try {
    const doctor = await Doctor.findOne({ cnic });

    if (!doctor) {
      return res.status(401).json({ error: 'Please Signup First!' });
    }
 
    const passwordMatch = await bcrypt.compare(password, doctor.password);

    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    res.status(200).json({ message: 'Signin successful', doctor });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = { Signup, Signin };