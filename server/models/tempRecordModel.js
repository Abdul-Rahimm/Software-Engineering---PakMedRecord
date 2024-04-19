const mongoose = require('mongoose');

const tempRecordSchema = new mongoose.Schema({
    patientCNIC: {
        type: Number,
        required: true
    },
    doctorCNIC: {
        type: Number,
        required: true
    },
    recordData: {
        type: String,
        required: true
    },
    status: {
        type: String,
        enum: ['pending', 'approved', 'rejected'],
        default: 'pending'
    }
});

module.exports = mongoose.model('TempMedicalRecord', tempRecordSchema);
