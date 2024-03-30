const bcrypt = require('bcrypt');
const Doctor = require('../models/DoctorModel');
const expressAsyncHandler = require('express-async-handler');
const Patient = require('../models/PatientModel');

const Signup = expressAsyncHandler(async (req, res) => {
  const { doctorCNIC, firstName, lastName, email, password, hospital } = req.body;

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

    res.status(200).json({ message: 'Signin successful', doctor });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

const getDoctor = expressAsyncHandler(async (req, res) => {
  try {
    const { doctorCNIC } = req.params; // Access the doctor ID from URL parameters
    console.log('Fetching doctor with cnic:', doctorCNIC);

    // Validate that id is a valid ObjectId (assuming you're using MongoDB)
  
    const doctor = await Doctor.findOne({doctorCNIC: doctorCNIC});

    if (doctor !== null) {
      res.status(200).json(doctor);
      console.log({ message: 'Successfully fetched!', doctor });
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
    if (doctors.length > 0) {
      res.status(200).json(doctors);
      console.log('Successfully fetched all doctors:', doctors);
    } else {
      res.status(404).json({ message: 'No doctors found' });
    }
  } catch (error) {
    console.error('Error fetching doctors:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});


const deleteDoctor = expressAsyncHandler(async (req, res) => {
  try {
    // Extract doctorId from the request parameters
    const { id } = req.params;

    // Query the database to find and remove the doctor by ID
    const deletedDoctor = await Doctor.findByIdAndDelete(id);

    if (deletedDoctor) {
      // If the doctor is found and deleted, send a success message in the response
      res.status(200).json({ message: 'Doctor deleted successfully', deletedDoctor });
    } else {
      // If the doctor is not found, send a 404 status
      res.status(404).json({ message: 'Doctor not found' });
    }
  } catch (error) {
    // Handle other errors that might occur during the database query or processing
    res.status(500).json({ message: 'Internal Server Error' });
    console.log(error.message)
  }
});

const deleteAllDoctors = expressAsyncHandler(async (req, res) => {
  try {
    // Delete all doctors from the database
    const result = await Doctor.deleteMany({});

    // Check if any doctors were deleted
    if (result.deletedCount > 0) {
      // If doctors are deleted, send a success message in the response
      res.status(200).json({ message: 'All doctors deleted successfully' });
    } else {
      // If no doctors are found, send a 404 status
      res.status(404).json({ message: 'No doctors found to delete' });
    }
  } catch (error) {
    // Handle other errors that might occur during the database query or processing
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

module.exports = { Signup, Signin, getDoctor,getAllDoctors, deleteDoctor, deleteAllDoctors };