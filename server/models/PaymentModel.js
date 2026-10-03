const mongoose = require('mongoose');

// An online payment attempt for an appointment's consultation fee
const paymentSchema = new mongoose.Schema({
  appointmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment', required: true },
  patientCNIC: { type: Number, required: true, index: true },
  doctorCNIC: { type: Number, required: true, index: true },
  amount: { type: Number, required: true, min: 1 },
  currency: { type: String, default: 'PKR' },
  provider: { type: String, enum: ['safepay', 'test', 'clinic', 'jazzcash'], required: true },
  status: { type: String, enum: ['initiated', 'paid', 'failed', 'cancelled', 'refund_due', 'refunded'], default: 'initiated' },
  // Safepay: the merchant account the money went to, and Safepay's order id ("tracker")
  accountId: { type: mongoose.Schema.Types.ObjectId, ref: 'PaymentAccount' },
  environment: { type: String, enum: ['sandbox', 'production'] },
  tracker: { type: String, index: true },
  refundedAt: Date,
  refundNote: String,
  lastCheckedAt: Date,
  // Platform commission (online payments only). Rate is snapshotted at payment time.
  payee: { type: { type: String, enum: ['clinic', 'doctor'] }, id: String, name: String },
  commissionRate: Number, // percent
  commissionAmount: Number, // rupees
  invoiceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Invoice' },
  txnRef: { type: String, required: true, unique: true },
  providerRef: String,
  message: String,
  paidAt: Date,
}, { timestamps: true });

paymentSchema.index({ provider: 1, status: 1, paidAt: -1 });

module.exports = mongoose.model('Payment', paymentSchema);
