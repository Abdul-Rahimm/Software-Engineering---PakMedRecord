const mongoose = require('mongoose');
const { RECORD_CATEGORIES } = require('./constants');

const tempRecordSchema = new mongoose.Schema({
    patientCNIC: {
        type: Number,
        required: true
    },
    doctorCNIC: {
        type: Number,
        required: true
    },
    title: { type: String, trim: true, maxlength: 120 },
    category: { type: String, enum: RECORD_CATEGORIES, default: 'General' },
    recordData: {
        type: String,
        required: true
    },
    reviewNote: { type: String, trim: true, maxlength: 500 },
    reviewedAt: { type: Date },
    status: {
        type: String,
        enum: ['pending', 'approved', 'rejected'],
        default: 'pending'
    }
}, { timestamps: true });

module.exports = mongoose.model('TempMedicalRecord', tempRecordSchema);
