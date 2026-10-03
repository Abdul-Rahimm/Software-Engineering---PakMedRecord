const mongoose = require('mongoose');

// Monthly platform-fee invoice to a clinic or solo doctor: the commission on the online
// consultation fees they received through Safepay in that month.
const invoiceSchema = new mongoose.Schema({
  number: { type: String, required: true, unique: true }, // e.g. PMR-2026-10-0007
  payee: {
    type: { type: String, enum: ['clinic', 'doctor'], required: true },
    id: { type: String, required: true },
    name: String,
    email: String,
  },
  period: { type: String, required: true }, // YYYY-MM
  environment: { type: String, enum: ['sandbox', 'production'], default: 'production' },
  payments: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Payment' }],
  paymentCount: Number,
  grossAmount: Number, // fees the payee received
  commissionAmount: { type: Number, required: true }, // what they owe the platform
  status: { type: String, enum: ['open', 'paid', 'void'], default: 'open' },
  dueAt: Date,
  paidAt: Date,
  paidNote: String,
  createdBy: String,
}, { timestamps: true });

invoiceSchema.index({ 'payee.type': 1, 'payee.id': 1, period: 1 });

module.exports = mongoose.model('Invoice', invoiceSchema);
