// RecordController.js

const MedicalRecord = require('../models/tempRecordModel');
const Doctor = require('../models/DoctorModel');
const Patient = require('../models/PatientModel');
const Affiliation = require('../models/AffiliationModel');


const submit = async (req, res) => {
    try {
        const { doctorCNIC, recordData, status } = req.body;
        const { patientCNIC } = req.params;
        
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

        const affiliation = await Affiliation.findOne({ patientCNIC, doctorCNIC });
        if (!affiliation) {
          return res.status(403).json({ error: 'Patient and doctor are not affiliated' });
        }

        // Store the medical record with provided status
        const medicalRecord = new MedicalRecord({ patientCNIC, doctorCNIC, recordData, status });
        await medicalRecord.save();
        
        res.status(201).json({ message: 'Medical record submitted for approval' });
    } catch (error) {
        console.error('Error submitting medical record:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

const pending = async (req, res) => {
    try {
        const { doctorCNIC } = req.params;
        // Check if doctor exists
        const doctor = await Doctor.findOne({ doctorCNIC: doctorCNIC });
        if (!doctor) {
            return res.status(404).json({ error: 'Doctor not found' });
        }
        // Get pending medical records of affiliated patients
        const pendingRecords = await MedicalRecord.find({ status: 'pending', doctorCNIC: doctorCNIC });
        res.status(200).json({ pendingRecords });
    } catch (error) {
        console.error('Error fetching pending medical records:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};


const approve =  async (req, res) => {
    try {
        const { recordId } = req.params;
        const { status } = req.body;
        // Update the status of the medical record
        await MedicalRecord.findByIdAndUpdate(recordId, { status: status });
        res.status(200).json({ message: 'Medical record approval status updated successfully' });
    } catch (error) {
        console.error('Error updating medical record status:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

const remove =  async (req, res) => {
    try {
        const { recordId } = req.params;
        // Find the record by ID and delete it
        await MedicalRecord.findByIdAndDelete(recordId);
        res.status(200).json({ message: 'Temporary medical record deleted successfully' });
    } catch (error) {
        console.error('Error deleting temporary medical record:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

module.exports = { submit, pending, approve, remove };
