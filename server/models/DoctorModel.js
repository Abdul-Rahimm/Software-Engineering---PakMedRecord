const mongoose = require('mongoose');

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
        }
    }
);

const Doctor = mongoose.model('Doctor', doctorSchema);
module.exports = Doctor;