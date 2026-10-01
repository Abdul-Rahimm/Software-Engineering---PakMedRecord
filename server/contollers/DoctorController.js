const bcrypt = require('bcrypt');
const Doctor = require('../models/DoctorModel');
const expressAsyncHandler = require('express-async-handler');
const Patient = require('../models/PatientModel');
const { signToken } = require('../middleware/auth');

const Signup = expressAsyncHandler(async (req, res) => {
  const { doctorCNIC, firstName, lastName, email, password, hospital } = req.body;

  if (!doctorCNIC || !firstName || !lastName || !email || !password || !hospital) {
    return res.status(400).json({ error: 'All fields are required' });
  }

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
  const { doctorCNIC, password } = req.body;

  if (!doctorCNIC || !password ) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  try {
    const doctor = await Doctor.findOne({ doctorCNIC });

    if (!doctor) {
      return res.status(401).json({ error: 'Please Signup First!' });
    }
 
    const passwordMatch = await bcrypt.compare(password, doctor.password);

    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
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
    // Fetch all doctors from the database
    const doctors = await Doctor.find();

    // Check if any doctors were found
    res.status(200).json(doctors);
  } catch (error) {
    console.error('Error fetching doctors:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});


module.exports = { Signup, Signin, getDoctor, getAllDoctors };
