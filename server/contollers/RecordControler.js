// Import necessary modules and models
const MedicalRecord = require('../models/RecordModel');
const Patient = require('../models/PatientModel');
const Doctor = require('../models/DoctorModel');
const Affiliation = require('../models/AffiliationModel');
const { notify } = require('../lib/notify');
const { RECORD_CATEGORIES } = require('../models/constants');
const { claimAttachments } = require('./FileController');

// Endpoint to handle the creation of a medical record
const addRecord = async (req, res) => {
  try {
    const { patientCNIC, recordData, title, category, attachments } = req.body;
    if (category && !RECORD_CATEGORIES.includes(category)) {
      return res.status(400).json({ error: 'Unknown record category' });
    }
    // Records are always created by the signed-in doctor
    const doctorCNIC = req.user.cnic;

    if (!patientCNIC || (!String(recordData || '').trim() && !(attachments || []).length)) {
      return res.status(400).json({ error: 'Add record details or attach a file' });
    }

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

    // Files uploaded for this record (read by the AI); their summaries stand in if no notes were typed
    let files;
    try {
      files = await claimAttachments(attachments, req.user, patientCNIC);
    } catch (err) {
      return res.status(err.status || 500).json({ error: err.message });
    }
    const details = String(recordData || '').trim()
      || files.map((f) => f.ocr?.summary).filter(Boolean).join('\n')
      || 'See attached document.';

    // Create a new medical record
    const medicalRecord = new MedicalRecord({
      patientCNIC,
      doctorCNIC,
      recordData: details,
      title: title ? String(title).trim() : undefined,
      category: category || 'General',
      source: 'doctor',
      attachments: files.map((f) => f._id),
    });

    // Save the medical record to the database
    await medicalRecord.save();

    notify('patient', patientCNIC, {
      type: 'record',
      title: 'New medical record',
      body: `Dr. ${existingDoctor.firstName} ${existingDoctor.lastName} added ${medicalRecord.title ? `"${medicalRecord.title}"` : 'a record'} to your history.`,
      link: `/record/getrecords/${patientCNIC}`,
    });

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
      const medicalRecords = await MedicalRecord.find({ patientCNIC }).sort({ createdAt: -1 }).populate('attachments');
  
      res.status(200).json(medicalRecords);
    } catch (error) {
      console.error('Error fetching medical records:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };

  // A doctor can delete a record they wrote (e.g. to correct a mistake)
  const removeRecords = async (req, res) => {
    try {
      const record = await MedicalRecord.findById(req.params.recordId);
      if (!record) return res.status(404).json({ error: 'Record not found' });
      if (record.doctorCNIC !== req.user.cnic) return res.status(403).json({ error: 'Not allowed' });

      await record.deleteOne();
      res.status(200).json({ message: 'Medical record removed' });
    } catch (error) {
      console.error('Error removing medical records:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };

module.exports = { addRecord, getRecords, removeRecords};