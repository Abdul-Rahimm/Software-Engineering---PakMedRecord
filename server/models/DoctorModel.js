const mongoose = require('mongoose');

const doctorSchema = mongoose.Schema (
    {
        cnic:{
            type: Number,
            required: [true, 'Please enter your unique CNIC Number!']
        },
        username: {
            type: String,
            required: [true, 'Please add doctor name!']
        },
        email: {
            type: String,
            required: [true, 'Please enter your email!']
        },
        password: {
            type: String,
            required: [true, 'Please enter a password']
        },
        hospital: {
            type: String,
            required: [true, 'Please enter affiliated hospital!']
        }
    }
);

const Doctor = mongoose.model('Doctor', doctorSchema);
module.exports = Doctor;