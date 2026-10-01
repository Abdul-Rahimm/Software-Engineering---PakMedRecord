const mongoose = require('mongoose');
const { SPECIALIZATIONS } = require('./constants');

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
            required: [true, 'Please enter a password']
        },
        hospital: {
            type: String,
            required: [true, 'Please enter affiliated hospital!']
        },
        specialization: { type: String, enum: SPECIALIZATIONS, default: 'General Physician' },
        phone: { type: String, trim: true },
        bio: { type: String, trim: true, maxlength: 600 },
        yearsExperience: { type: Number, min: 0, max: 70 },
    },
    { timestamps: true }
);

// Never send password hashes back to the client
doctorSchema.set('toJSON', {
    transform: (doc, ret) => {
        delete ret.password;
        return ret;
    }
});

const Doctor = mongoose.model('Doctor', doctorSchema);
module.exports = Doctor;