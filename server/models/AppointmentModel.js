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
    status: {
        type: String,
        enum: ['pending', 'completed', 'cancelled'],
        required: true,
        default: 'pending'
    },
    reason: { type: String, trim: true, maxlength: 300 },
    cancelledBy: { type: String, enum: ['patient', 'doctor'] },
    cancelReason: { type: String, trim: true, maxlength: 300 },
}, { timestamps: true });

const Appointment = mongoose.model('Appointment', appointmentSchema);

module.exports = Appointment;
