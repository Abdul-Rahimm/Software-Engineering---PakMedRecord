const mongoose = require('mongoose');

const patientSchema = mongoose.Schema({
    cnic: {
        type: Number,
        required: true,
        unique: true,
    },
    firstName: {
        type: String,
        required: true,
    },
    lastName: {
        type: String,
        required: true,
    },
    email: {
        type: String,
        required: true,
    },
    password: {
        type: String,
        required: true,
    },
    dateOfBirth: {
        type: Date,
        required: true,
    },
    gender: {
        type: String,
        enum: ['Male', 'Female', 'Other'],
        required: true,
    },
}, {
    timestamps: true,
});

const Patient = mongoose.model('Patient', patientSchema);
module.exports = Patient;
