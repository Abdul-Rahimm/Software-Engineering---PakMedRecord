// TempRecordController.js

const TempRecord = require('../models/tempRecordModel');
const MedicalRecord = require('../models/RecordModel');
const Doctor = require('../models/DoctorModel');
const Patient = require('../models/PatientModel');
const Affiliation = require('../models/AffiliationModel');
const { notify } = require('../lib/notify');
const { RECORD_CATEGORIES } = require('../models/constants');


const submit = async (req, res) => {
    try {
        const { doctorCNIC, recordData, title, category } = req.body;

        if (!doctorCNIC || !recordData) {
            return res.status(400).json({ error: 'Doctor and record data are required' });
        }
        if (category && !RECORD_CATEGORIES.includes(category)) {
            return res.status(400).json({ error: 'Unknown record category' });
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
        const tempRecord = new TempRecord({
            patientCNIC,
            doctorCNIC,
            recordData,
            title: title ? String(title).trim() : undefined,
            category: category || 'General',
        });
        await tempRecord.save();

        notify('doctor', doctorCNIC, {
            type: 'submission',
            title: 'Record awaiting review',
            body: `${existingPatient.firstName} ${existingPatient.lastName} submitted ${tempRecord.title ? `"${tempRecord.title}"` : 'a record'} for approval.`,
            link: `/tempRecords/pending/${doctorCNIC}`,
        });
        
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
        const { status, reviewNote } = req.body;

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

        // Keep the submission (with its outcome) so the patient can see what happened to it
        tempRecord.status = status;
        tempRecord.reviewNote = reviewNote ? String(reviewNote).trim().slice(0, 500) : undefined;
        tempRecord.reviewedAt = new Date();
        await tempRecord.save();

        if (status === 'approved') {
            const { patientCNIC, doctorCNIC, recordData, title, category } = tempRecord;
            await MedicalRecord.create({ patientCNIC, doctorCNIC, recordData, title, category, source: 'patient' });
        }

        const label = tempRecord.title ? `"${tempRecord.title}"` : 'Your submitted record';
        notify('patient', tempRecord.patientCNIC, {
            type: status === 'approved' ? 'approved' : 'rejected',
            title: status === 'approved' ? 'Record approved' : 'Record not approved',
            body: status === 'approved'
                ? `${label} was verified and added to your history.`
                : `${label} was not approved${tempRecord.reviewNote ? `: ${tempRecord.reviewNote}` : '.'}`,
            link: status === 'approved' ? `/record/getrecords/${tempRecord.patientCNIC}` : `/tempRecords/submit/${tempRecord.patientCNIC}`,
        });

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

// A patient's own submissions with their review outcome (newest first)
const mine = async (req, res) => {
    try {
        const submissions = await TempRecord.find({ patientCNIC: req.params.patientCNIC }).sort({ createdAt: -1 }).limit(100);
        res.status(200).json({ submissions });
    } catch (error) {
        console.error('Error fetching submissions:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

module.exports = { submit, pending, approve, remove, mine };
