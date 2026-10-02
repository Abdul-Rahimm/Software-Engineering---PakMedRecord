const mongoose = require('mongoose');
const { SPECIALIZATIONS } = require('./constants');
const { accountFields } = require('./accountFields');

const doctorSchema = mongoose.Schema (
    {
        doctorCNIC:{
            type: Number,
            required: [true, 'Please enter your unique CNIC Number!'],
            unique: true,
        },
        firstName: {
            type: String,
            required: [true, 'Please add first name!']
        },
        lastName: {
            type: String,
            required: [true, 'Please add last name!']
        },
        email: {
            type: String,
            required: [true, 'Please enter your email!'],
            unique: true,
            
        },
        password: {
            type: String,
            // Google-only accounts have no password
            required: [function () { return !this.googleUid; }, 'Please enter a password']
        },
        hospital: {
            type: String,
            required: [true, 'Please enter affiliated hospital!']
        },
        specialization: { type: String, enum: SPECIALIZATIONS, default: 'General Physician' },
        phone: { type: String, trim: true },
        bio: { type: String, trim: true, maxlength: 600 },
        yearsExperience: { type: Number, min: 0, max: 70 },
        // Email verification (accounts created before this feature have no flag and count as verified)
        emailVerified: { type: Boolean },
        emailVerifyTokenHash: { type: String, select: false },
        emailVerifyExpires: { type: Date, select: false },
        // Linked Google account (Firebase Auth uid) for "Sign in with Google"
        googleUid: { type: String, index: { unique: true, sparse: true } },
        ...accountFields,
        // PMDC verification. Accounts created before this feature have no status and count as verified.
        verification: {
            status: { type: String, enum: ['unverified', 'pending', 'verified', 'rejected'] },
            pmdcNumber: { type: String, trim: true, maxlength: 40 },
            document: { gridId: mongoose.Schema.Types.ObjectId, name: String, mime: String, size: Number },
            note: { type: String, trim: true, maxlength: 500 },
            submittedAt: Date,
            reviewedAt: Date,
        },
        // Public profile (shown in the doctor directory once verified)
        city: { type: String, trim: true, maxlength: 60 },
        clinicAddress: { type: String, trim: true, maxlength: 200 },
        fee: { type: Number, min: 0, max: 100000 },
        languages: [{ type: String, trim: true }],
        qualifications: { type: String, trim: true, maxlength: 200 },
        // Weekly clinic hours; without them the doctor is open Mon-Sat 09:00-17:00 in 30-minute slots
        availability: {
            slotMinutes: { type: Number, enum: [10, 15, 20, 30, 45, 60] },
            days: [{ _id: false, day: { type: Number, min: 0, max: 6 }, start: String, end: String }],
            holidays: [{ type: String }],
            videoConsults: { type: Boolean },
        },
        clinicId: { type: mongoose.Schema.Types.ObjectId, ref: 'Clinic' },
    },
    { timestamps: true }
);

// Never send password hashes back to the client
doctorSchema.set('toJSON', {
    virtuals: true,
    transform: (doc, ret) => {
        delete ret.password;
        if (ret.verification?.document) delete ret.verification.document.gridId;
        return ret;
    }
});

doctorSchema.virtual('isVerified').get(function () {
    return !this.verification?.status || this.verification.status === 'verified';
});
doctorSchema.set('toObject', { virtuals: true });

const Doctor = mongoose.model('Doctor', doctorSchema);
module.exports = Doctor;