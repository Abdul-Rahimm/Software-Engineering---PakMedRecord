const mongoose = require('mongoose');
const { BLOOD_GROUPS } = require('./constants');

const medicationSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    dose: { type: String, trim: true },
    frequency: { type: String, trim: true },
}, { _id: false });

const vaccinationSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    date: { type: Date },
    dose: { type: String, trim: true },
}, { _id: false });

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
        // Google-only accounts have no password
        required: function () { return !this.googleUid; },
    },
    hospital: {
        type: String,
        required: true,
    },
    gender: {
        type: String,
        enum: ['Male', 'Female', 'Other'],
        required: true,
    },
    // Health profile (patient-maintained, visible to affiliated doctors)
    dateOfBirth: { type: Date },
    phone: { type: String, trim: true },
    bloodGroup: { type: String, enum: [...BLOOD_GROUPS, ''], default: '' },
    heightCm: { type: Number, min: 30, max: 260 },
    weightKg: { type: Number, min: 1, max: 400 },
    allergies: [{ type: String, trim: true }],
    chronicConditions: [{ type: String, trim: true }],
    medications: [medicationSchema],
    familyHistory: [{ type: String, trim: true }],
    vaccinations: [vaccinationSchema],
    // Email verification (accounts created before this feature have no flag and count as verified)
    emailVerified: { type: Boolean },
    emailVerifyTokenHash: { type: String, select: false },
    emailVerifyExpires: { type: Date, select: false },
    // Linked Google account (Firebase Auth uid) for "Sign in with Google"
    googleUid: { type: String, index: { unique: true, sparse: true } },
    emergencyContact: {
        name: { type: String, trim: true },
        relation: { type: String, trim: true },
        phone: { type: String, trim: true },
    },
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
