const express = require('express');
const router = express.Router();
const Affiliation = require('../models/AffiliationModel');
const Patient = require('../models/PatientModel');
const Doctor = require('../models/DoctorModel');
const { notify } = require('../lib/notify');

// POST request to create an affiliation record
const affiliate = async (req, res) => {
  try {
    // The patient is always the signed-in user
    const patientCNIC = req.user.cnic;
    // Doctors can be chosen by CNIC (in-app search) or by id (public directory)
    let doctorCNIC = [].concat(req.body.doctorCNIC || []).map(Number);
    const ids = [].concat(req.body.doctorId || []).filter((id) => /^[a-f0-9]{24}$/i.test(String(id)));
    if (ids.length) {
      const found = await Doctor.find({ _id: { $in: ids } }).select('doctorCNIC');
      doctorCNIC = [...doctorCNIC, ...found.map((d) => d.doctorCNIC)];
    }

    if (doctorCNIC.length === 0) {
      return res.status(400).json({ error: 'Select at least one doctor' });
    }
    // a doctor who is also a patient can't be their own treating doctor
    if (doctorCNIC.includes(patientCNIC)) {
      return res.status(400).json({ error: 'You can\'t add yourself as your own doctor' });
    }

    // Check if the patient exists 
    const existingPatient = await Patient.findOne({ patientCNIC });
    if (!existingPatient) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    // Check if all doctors exist
    const existingDoctors = await Doctor.find({ doctorCNIC: { $in: doctorCNIC } });
    if (existingDoctors.length !== new Set(doctorCNIC).size) {
      return res.status(404).json({ error: 'One or more doctors not found' });
    }
    if (existingDoctors.some((d) => !d.isVerified || d.disabled)) {
      return res.status(403).json({ error: 'You can only add PMDC-verified doctors to your care team' });
    }

    // Check if any of the selected doctors are already affiliated with the patient
    const existingAffiliations = await Affiliation.find({ patientCNIC, doctorCNIC: { $in: doctorCNIC } });
    if (existingAffiliations.length > 0) {
      const alreadyAffiliatedDoctors = existingAffiliations
        .flatMap((affiliation) => affiliation.doctorCNIC)
        .filter((cnic) => doctorCNIC.includes(cnic));
      return res.status(400).json({ error: `One or more doctors are already affiliated with the patient: ${alreadyAffiliatedDoctors}` });
    }

    // Add the doctors to the patient's affiliation record (created if missing)
    await Affiliation.updateOne(
      { patientCNIC },
      { $addToSet: { doctorCNIC: { $each: doctorCNIC } } },
      { upsert: true }
    );

    const patientName = `${existingPatient.firstName} ${existingPatient.lastName}`;
    doctorCNIC.forEach((d) => notify('doctor', d, {
      type: 'affiliation',
      title: 'New patient',
      body: `${patientName} added you to their care team.`,
      link: `/records/getrecords/${patientCNIC}`,
    }));

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

    // Find affiliations that include this doctor
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

    // Remove only this doctor; the patient may be affiliated with others in the same document
    const result = await Affiliation.updateMany({ patientCNIC, doctorCNIC }, { $pull: { doctorCNIC: Number(doctorCNIC) } });

    // Check if the affiliation was found
    if (result.modifiedCount === 0) {
      return res.status(404).json({ error: 'Affiliation not found' });
    }

    await Affiliation.deleteMany({ patientCNIC, doctorCNIC: { $size: 0 } });

    // Send a success response
    res.status(200).json({ message: 'Affiliation deleted successfully' });
  } catch (error) {
    console.error('Error deleting affiliation:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};




module.exports = { affiliate, getMyDoctors, removeDoctor, getMyPatients };
