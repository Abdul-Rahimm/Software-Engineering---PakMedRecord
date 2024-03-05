const bcrypt = require('bcrypt');
const Doctor = require('../models/DoctorModel');
const expressAsyncHandler = require('express-async-handler');

const Signup = expressAsyncHandler(async (req, res) => {
    const { cnic, username, email, password, hospital } = req.body;

    try {
        const existingDoctor = await Doctor.findOne({ cnic });
        if (existingDoctor) {
            return res.status(409).json({ error: 'Doctor already registered!' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const newDoctor = new Doctor({
            cnic,
            username,
            email,
            password: hashedPassword,
            hospital
        });

        await newDoctor.save();

        res.status(201).json({ message: 'Signup successful', newDoctor });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }

});

const Signin = expressAsyncHandler(async (req, res) => {
    const { cnic, username, email, password, hospital } = req.body;
  
    if (!cnic || !username || !email || !password || !hospital) {
      return res.status(400).json({ error: 'All fields are required' });
    }
  
    try {
      const doctor = await Doctor.findOne({ cnic });
  
      if (!doctor) {
        return res.status(401).json({ error: 'Please Signup First!' });
      }
  
      if (doctor.username !== username || doctor.email !== email || doctor.hospital !== hospital) {
        return res.status(401).json({ error: 'Invalid credentials' });
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