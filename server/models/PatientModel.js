const mongoose = require('mongoose');
const { BLOOD_GROUPS } = require('./constants');
const { accountFields } = require('./accountFields');

const medicationSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    dose: { type: String, trim: true },
    frequency: { type: String, trim: true },
    // medication tracker: daily dose times (HH:MM), course dates and next refill
    times: [{ type: String }],
    startDate: { type: Date },
    endDate: { type: Date },
    refillDate: { type: Date },
    prescriptionCode: { type: String },
}, { _id: false });

const vaccinationSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    date: { type: Date },
    dose: { type: String, trim: true },
    // code from the EPI schedule (e.g. "penta1") when given from the schedule
    code: { type: String, trim: true },
}, { _id: false });

// Dependents (children, elderly parents) have no login of their own and are managed by a guardian
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
        required: function () { return !this.guardianCNIC; },
    },
    password: {
        type: String,
        // Google-only accounts have no password
        required: function () { return !this.googleUid && !this.guardianCNIC; },
    },
    hospital: {
        type: String,
        required: function () { return !this.guardianCNIC; },
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
    ...accountFields,
    guardianCNIC: { type: Number, index: true },
    relation: { type: String, trim: true, maxlength: 40 },
    // Read-only emergency page behind a QR code (patient switches it on)
    emergencyAccess: {
        enabled: { type: Boolean, default: false },
        token: { type: String, index: { unique: true, sparse: true } },
    },
    notificationPrefs: {
        email: { type: Boolean, default: true },
        whatsapp: { type: Boolean, default: false },
        sms: { type: Boolean, default: false },
        appointmentReminders: { type: Boolean, default: true },
        medicationReminders: { type: Boolean, default: true },
    },
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
        ret.hasPassword = Boolean(ret.password);
        delete ret.password;
        delete ret.twoFactor?.secret;
        return ret;
    }
});

const Patient = mongoose.model('Patient', patientSchema);
module.exports = Patient;
