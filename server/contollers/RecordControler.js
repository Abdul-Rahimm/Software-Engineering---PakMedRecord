// Import necessary modules and models
const express = require('express');
const router = express.Router();
const MedicalRecord = require('../models/RecordModel');
const Patient = require('../models/PatientModel');
const Doctor = require('../models/DoctorModel');
const Affiliation = require('../models/AffiliationModel');

// Endpoint to handle the creation of a medical record
const addRecord = async (req, res) => {
  try {
    const { patientCNIC, doctorCNIC, recordData } = req.body;

    // Check if patient exists
    const existingPatient = await Patient.findOne({ patientCNIC });
    if (!existingPatient) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    // Check if doctor exists
    const existingDoctor = await Doctor.findOne({ doctorCNIC });
    if (!existingDoctor) {
      return res.status(404).json({ error: 'Doctor not found' });
    }

    // Check if patient and doctor are affiliated
    const affiliation = await Affiliation.findOne({ patientCNIC, doctorCNIC });
    if (!affiliation) {
      return res.status(403).json({ error: 'Patient and doctor are not affiliated' });
    }

    // Create a new medical record
    const medicalRecord = new MedicalRecord({
      patientCNIC,
      doctorCNIC,
      recordData
    });

    // Save the medical record to the database
    await medicalRecord.save();

    res.status(201).json({ message: 'Medical record created successfully', medicalRecord });
  } catch (error) {
    console.error('Error creating medical record:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getRecords = async (req, res) => {
    try {
      const { patientCNIC } = req.params;
  
      // Fetch medical records based on patient CNIC
      const medicalRecords = await MedicalRecord.find({ patientCNIC });
  
      res.status(200).json(medicalRecords);
    } catch (error) {
      console.error('Error fetching medical records:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };

  const removeRecords = async (req, res) => {
    try {
      const { doctorCNIC } = req.params;
  
      // Delete medical records where the doctorCNIC matches
      await MedicalRecord.deleteMany({ doctorCNIC });
  
      res.status(200).json({ message: 'Medical records removed successfully' });
    } catch (error) {
      console.error('Error removing medical records:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };

module.exports = { addRecord, getRecords, removeRecords};
