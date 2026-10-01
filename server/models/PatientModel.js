const mongoose = require('mongoose');

const patientSchema = mongoose.Schema({
    patientCNIC: {
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
    hospital: {
        type: String,
        required: true,
    },
    gender: {
        type: String,
        enum: ['Male', 'Female', 'Other'],
        required: true,
    }
}, {
    timestamps: true,
});

// Never send password hashes back to the client
patientSchema.set('toJSON', {
    transform: (doc, ret) => {
        delete ret.password;
        return ret;
    }
});

const Patient = mongoose.model('Patient', patientSchema);
module.exports = Patient;
