const express = require('express');
const router = express.Router();
const Affiliation = require('../models/AffiliationModel');
const Patient = require('../models/PatientModel');
const Doctor = require('../models/DoctorModel');

// POST request to create an affiliation record
const affiliate = async (req, res) => {
  try {
    const { patientCNIC, doctorCNIC } = req.body;

    // Check if the patient exists
    const existingPatient = await Patient.findOne({ patientCNIC });
    if (!existingPatient) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    // Check if all doctors exist
    const existingDoctors = await Doctor.find({ doctorCNIC: { $in: doctorCNIC } });
    if (existingDoctors.length !== doctorCNIC.length) {
      return res.status(404).json({ error: 'One or more doctors not found' });
    }

    // Check if an affiliation already exists for the given patientCNIC
    const existingAffiliation = await Affiliation.findOne({ patientCNIC });
    if (existingAffiliation) {
      return res.status(400).json({ error: 'Affiliation already exists for this patient' });
    }

    // Create a new affiliation record
    const affiliation = new Affiliation({
      patientCNIC,
      doctorCNIC
    });

    // Save the affiliation record to the database
    await affiliation.save();

    res.status(201).json({ message: 'Affiliation created successfully' });
  } catch (error) {
    console.error('Error creating affiliation:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = { affiliate };
