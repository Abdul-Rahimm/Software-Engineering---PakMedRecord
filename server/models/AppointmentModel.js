const mongoose = require('mongoose');

const appointmentSchema = new mongoose.Schema({
    patientCNIC: {
        type: Number, 
        required: true
    },
    doctorCNIC: {
        type: Number, 
        required: true
    },
    date: {
        type: Date,
        required: true
    },
    time: {
        type: String, 
        required: true
    },
    createdAt: {
        type: Date,
    }
});

const Appointment = mongoose.model('Appointment', appointmentSchema);

module.exports = Appointment;
