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
        enum: ['pending', 'completed', 'cancelled', 'no-show'],
        required: true,
        default: 'pending'
    },
    reason: { type: String, trim: true, maxlength: 300 },
    cancelledBy: { type: String, enum: ['patient', 'doctor'] },
    cancelReason: { type: String, trim: true, maxlength: 300 },
    // 'video' visits happen in the in-app video room
    mode: { type: String, enum: ['in-person', 'video'], default: 'in-person' },
    roomId: { type: String },
    checkedInAt: { type: Date },
    fee: { type: Number, min: 0 },
    payment: {
        status: { type: String, enum: ['unpaid', 'paid', 'refunded'], default: 'unpaid' },
        method: { type: String, enum: ['clinic', 'jazzcash', 'test', ''], default: '' },
        paidAt: { type: Date },
        paymentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment' },
    },
    // who made the booking: the patient, or clinic front-desk staff
    bookedBy: { role: { type: String, enum: ['patient', 'staff', 'assistant'] }, id: String },
    clinicId: { type: mongoose.Schema.Types.ObjectId, ref: 'Clinic' },
}, { timestamps: true });

appointmentSchema.index({ doctorCNIC: 1, date: 1 });
appointmentSchema.index({ patientCNIC: 1, date: 1 });

const Appointment = mongoose.model('Appointment', appointmentSchema);

module.exports = Appointment;
