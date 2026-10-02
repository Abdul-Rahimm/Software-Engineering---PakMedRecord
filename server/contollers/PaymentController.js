// Paying consultation fees online (JazzCash, or the simulated test checkout) and receipts.

const mongoose = require('mongoose');
const expressAsyncHandler = require('express-async-handler');
const Payment = require('../models/PaymentModel');
const Appointment = require('../models/AppointmentModel');
const Doctor = require('../models/DoctorModel');
const { notify } = require('../lib/notify');
const { describe } = require('../lib/appointments');
const { APP_URL } = require('../lib/accounts');
const { providers, jazzcashCheckout, jazzcashVerify, newTxnRef } = require('../lib/payments');

const API_URL = () => (process.env.API_URL || '').replace(/\/$/, '');

const markPaid = async (payment, providerRef, message) => {
  payment.status = 'paid';
  payment.providerRef = providerRef;
  payment.message = message;
  payment.paidAt = new Date();
  await payment.save();
  const a = await Appointment.findById(payment.appointmentId);
  if (a) {
    a.payment = { status: 'paid', method: payment.provider, paidAt: payment.paidAt, paymentId: payment._id };
    await a.save();
    notify('doctor', a.doctorCNIC, { type: 'payment', title: 'Fee paid online', body: `Rs ${payment.amount} received for the appointment on ${describe(a)}.`, link: `/appointments/fetch/${a.doctorCNIC}` });
  }
};

// POST /payments/checkout { appointmentId, provider }
const checkout = expressAsyncHandler(async (req, res) => {
  const { appointmentId, provider } = req.body || {};
  if (!providers().includes(provider)) return res.status(400).json({ error: 'That payment method is not available' });
  if (!mongoose.isValidObjectId(appointmentId)) return res.status(404).json({ error: 'Appointment not found' });
  const a = await Appointment.findById(appointmentId);
  if (!a || a.patientCNIC !== req.user.cnic) return res.status(404).json({ error: 'Appointment not found' });
  if (a.status !== 'pending') return res.status(409).json({ error: `This appointment is ${a.status}` });
  if (a.payment?.status === 'paid') return res.status(409).json({ error: 'Already paid' });
  const fee = a.fee || (await Doctor.findOne({ doctorCNIC: a.doctorCNIC }))?.fee;
  if (!fee) return res.status(400).json({ error: 'This doctor has not set a consultation fee. Pay at the clinic.' });

  const payment = await Payment.create({
    appointmentId: a._id, patientCNIC: a.patientCNIC, doctorCNIC: a.doctorCNIC, amount: fee, provider, txnRef: newTxnRef(),
  });
  if (provider === 'jazzcash') {
    const returnUrl = `${API_URL() || `${req.protocol}://${req.get('host')}`}/payments/jazzcash/return`;
    return res.status(201).json({ payment, checkout: jazzcashCheckout(payment, returnUrl) });
  }
  // test mode: the frontend shows a simulated checkout page
  res.status(201).json({ payment, checkout: { redirect: `/pay/test/${payment.txnRef}` } });
});

// JazzCash posts the result here (form-encoded), then we send the browser back to the app
const jazzcashReturn = expressAsyncHandler(async (req, res) => {
  const result = jazzcashVerify(req.body || {});
  const payment = result.txnRef && (await Payment.findOne({ txnRef: result.txnRef, provider: 'jazzcash' }));
  if (payment && result.valid && payment.status === 'initiated') {
    if (result.paid) await markPaid(payment, result.providerRef, result.message);
    else {
      payment.status = 'failed';
      payment.message = result.message;
      await payment.save();
    }
  }
  res.redirect(303, `${APP_URL()}/payments/result?ref=${encodeURIComponent(result.txnRef || '')}`);
});

// Simulated checkout (PAYMENTS_TEST_MODE=1): POST /payments/test/:txnRef { success }
const testComplete = expressAsyncHandler(async (req, res) => {
  if (!providers().includes('test')) return res.status(404).json({ error: 'Test payments are off' });
  const payment = await Payment.findOne({ txnRef: req.params.txnRef, provider: 'test', patientCNIC: req.user.cnic });
  if (!payment) return res.status(404).json({ error: 'Payment not found' });
  if (payment.status !== 'initiated') return res.status(409).json({ error: `Payment already ${payment.status}` });
  if (req.body?.success) await markPaid(payment, `TEST-${Date.now()}`, 'Simulated payment (no money moved)');
  else {
    payment.status = 'failed';
    payment.message = 'Cancelled in the test checkout';
    await payment.save();
  }
  res.status(200).json({ payment });
});

const byRef = expressAsyncHandler(async (req, res) => {
  const payment = await Payment.findOne({ txnRef: req.params.txnRef }).lean();
  const { role, cnic } = req.user;
  if (!payment || (role === 'patient' && payment.patientCNIC !== cnic) || (role === 'doctor' && payment.doctorCNIC !== cnic)) {
    return res.status(404).json({ error: 'Payment not found' });
  }
  const [appointment, doctor] = await Promise.all([
    Appointment.findById(payment.appointmentId).lean(),
    Doctor.findOne({ doctorCNIC: payment.doctorCNIC }).select('firstName lastName hospital specialization clinicAddress').lean(),
  ]);
  res.status(200).json({ payment, appointment, doctor });
});

// Patient's paid payments, for receipts
const mine = expressAsyncHandler(async (req, res) => {
  const payments = await Payment.find({ patientCNIC: req.user.cnic, status: 'paid' }).sort({ paidAt: -1 }).limit(100).lean();
  res.status(200).json(payments);
});

module.exports = { checkout, jazzcashReturn, testComplete, byRef, mine };
