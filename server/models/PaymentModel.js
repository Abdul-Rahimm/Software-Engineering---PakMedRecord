const mongoose = require('mongoose');

// An online payment attempt for an appointment's consultation fee
const paymentSchema = new mongoose.Schema({
  appointmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment', required: true },
  patientCNIC: { type: Number, required: true, index: true },
  doctorCNIC: { type: Number, required: true, index: true },
  amount: { type: Number, required: true, min: 1 },
  currency: { type: String, default: 'PKR' },
  provider: { type: String, enum: ['jazzcash', 'test', 'clinic'], required: true },
  status: { type: String, enum: ['initiated', 'paid', 'failed'], default: 'initiated' },
  txnRef: { type: String, required: true, unique: true },
  providerRef: String,
  message: String,
  paidAt: Date,
}, { timestamps: true });

module.exports = mongoose.model('Payment', paymentSchema);
