// TempRecordController.js

const TempRecord = require('../models/tempRecordModel');
const MedicalRecord = require('../models/RecordModel');
const Doctor = require('../models/DoctorModel');
const Patient = require('../models/PatientModel');
const Affiliation = require('../models/AffiliationModel');


const submit = async (req, res) => {
    try {
        const { doctorCNIC, recordData } = req.body;

        if (!doctorCNIC || !recordData) {
            return res.status(400).json({ error: 'Doctor and record data are required' });
        }
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

        // Store the record as pending until the doctor reviews it
        const tempRecord = new TempRecord({ patientCNIC, doctorCNIC, recordData });
        await tempRecord.save();
        
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
        const pendingRecords = await TempRecord.find({ status: 'pending', doctorCNIC: doctorCNIC });
        res.status(200).json({ pendingRecords });
    } catch (error) {
        console.error('Error fetching pending medical records:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};


// Doctor approves (moves into permanent records) or rejects a pending record
const approve = async (req, res) => {
    try {
        const { recordId } = req.params;
        const { status } = req.body;

        if (!['approved', 'rejected'].includes(status)) {
            return res.status(400).json({ error: "Status must be 'approved' or 'rejected'" });
        }

        const tempRecord = await TempRecord.findById(recordId);
        if (!tempRecord) {
            return res.status(404).json({ error: 'Record not found' });
        }
        if (tempRecord.doctorCNIC !== req.user.cnic) {
            return res.status(403).json({ error: 'Not allowed' });
        }
        if (tempRecord.status !== 'pending') {
            return res.status(409).json({ error: 'Record has already been reviewed' });
        }

        if (status === 'approved') {
            const { patientCNIC, doctorCNIC, recordData } = tempRecord;
            await MedicalRecord.create({ patientCNIC, doctorCNIC, recordData });
            await TempRecord.findByIdAndDelete(recordId);
        } else {
            tempRecord.status = 'rejected';
            await tempRecord.save();
        }

        res.status(200).json({ message: `Medical record ${status}` });
    } catch (error) {
        console.error('Error updating medical record status:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

const remove = async (req, res) => {
    try {
        const { recordId } = req.params;
        const tempRecord = await TempRecord.findById(recordId);
        if (!tempRecord) {
            return res.status(404).json({ error: 'Record not found' });
        }

        // Only the patient who submitted it or the doctor it was sent to can delete it
        const ownerCNIC = req.user.role === 'doctor' ? tempRecord.doctorCNIC : tempRecord.patientCNIC;
        if (ownerCNIC !== req.user.cnic) {
            return res.status(403).json({ error: 'Not allowed' });
        }

        await TempRecord.findByIdAndDelete(recordId);
        res.status(200).json({ message: 'Temporary medical record deleted successfully' });
    } catch (error) {
        console.error('Error deleting temporary medical record:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

module.exports = { submit, pending, approve, remove };
