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

    // Check if any of the selected doctors are already affiliated with the patient
    const existingAffiliations = await Affiliation.find({ patientCNIC, doctorCNIC: { $in: doctorCNIC } });
    if (existingAffiliations.length > 0) {
      const alreadyAffiliatedDoctors = existingAffiliations.map((affiliation) => affiliation.doctorCNIC);
      return res.status(400).json({ error: `One or more doctors are already affiliated with the patient: ${alreadyAffiliatedDoctors}` });
    }

    // Create a new affiliation record
    const affiliation = new Affiliation({
      patientCNIC,
      doctorCNIC,
    });

    // Save the affiliation record to the database
    await affiliation.save();

    res.status(201).json({ message: 'Affiliation created successfully' });
  } catch (error) {
    console.error('Error creating affiliation:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};


const getMyDoctors = async (req, res) => {
  try {
    const { patientCNIC } = req.params;

    // Find affiliations based on the patient's CNIC
    const affiliations = await Affiliation.find({ patientCNIC });

    // Return the affiliations
    res.status(200).json(affiliations);
  } catch (error) {
    console.error('Error fetching affiliations:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getMyPatients = async (req, res) => {
  try {
    const { doctorCNIC } = req.params;

    // Find affiliations based on the patient's CNIC
    const affiliations = await Affiliation.find({ doctorCNIC });

    // Return the affiliations
    res.status(200).json(affiliations);
  } catch (error) {
    console.error('Error fetching affiliations:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const removeDoctor = async (req, res) => {
  try {
    // Extract the patient and doctor CNICs from the request parameters
    const { patientCNIC, doctorCNIC } = req.params;

    // Use Mongoose to find and delete the affiliation document
    const deletedAffiliation = await Affiliation.findOneAndDelete({ patientCNIC, doctorCNIC });

    // Check if the affiliation was found and deleted
    if (!deletedAffiliation) {
      return res.status(404).json({ error: 'Affiliation not found' });
    }

    // Send a success response
    res.status(200).json({ message: 'Affiliation deleted successfully' });
  } catch (error) {
    console.error('Error deleting affiliation:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};




module.exports = { affiliate, getMyDoctors, removeDoctor, getMyPatients };
