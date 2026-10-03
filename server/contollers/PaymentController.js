// Consultation fees: Safepay checkout into the clinic's / doctor's own merchant account (option B),
// the simulated test checkout, status checks, refunds and receipts.

const mongoose = require('mongoose');
const expressAsyncHandler = require('express-async-handler');
const Payment = require('../models/PaymentModel');
const PaymentAccount = require('../models/PaymentAccountModel');
const Appointment = require('../models/AppointmentModel');
const Doctor = require('../models/DoctorModel');
const Clinic = require('../models/ClinicModel');
const { notify } = require('../lib/notify');
const { describe } = require('../lib/appointments');
const { APP_URL } = require('../lib/accounts');
const { encrypt, decrypt, mask } = require('../lib/secrets');
const safepay = require('../lib/safepay');
const { testModeEnabled, newTxnRef, accountForDoctor, onlineOptions } = require('../lib/payments');

const API_URL = (req) => (process.env.API_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');

const markPaid = async (payment, providerRef, message) => {
  if (payment.status === 'paid') return;
  payment.status = 'paid';
  payment.providerRef = providerRef;
  payment.message = message;
  payment.paidAt = new Date();
  await payment.save();
  const a = await Appointment.findById(payment.appointmentId);
  if (a) {
    a.fee = payment.amount;
    a.payment = { status: 'paid', method: payment.provider, paidAt: payment.paidAt, paymentId: payment._id };
    await a.save();
    notify('doctor', a.doctorCNIC, { type: 'payment', title: 'Fee paid online', body: `Rs ${payment.amount} received for the appointment on ${describe(a)}.`, link: `/appointments/fetch/${a.doctorCNIC}` });
    notify('patient', a.patientCNIC, { type: 'payment', title: 'Payment received', body: `Your Rs ${payment.amount} payment for ${describe(a)} went through.`, link: `/appointments/mine/${a.patientCNIC}` });
  }
};

// ---------- patient checkout ----------

// POST /payments/checkout { appointmentId, provider: 'safepay' | 'test' }
const checkout = expressAsyncHandler(async (req, res) => {
  const { appointmentId, provider } = req.body || {};
  if (!mongoose.isValidObjectId(appointmentId)) return res.status(404).json({ error: 'Appointment not found' });
  const a = await Appointment.findById(appointmentId);
  if (!a || a.patientCNIC !== req.user.cnic) return res.status(404).json({ error: 'Appointment not found' });
  if (a.status !== 'pending') return res.status(409).json({ error: `This appointment is ${a.status}` });
  if (a.payment?.status === 'paid') return res.status(409).json({ error: 'Already paid' });
  const fee = a.fee || (await Doctor.findOne({ doctorCNIC: a.doctorCNIC }))?.fee;
  if (!fee) return res.status(400).json({ error: 'This doctor has not set a consultation fee. Pay at the clinic.' });

  if (provider === 'test') {
    if (!testModeEnabled()) return res.status(400).json({ error: 'That payment method is not available' });
    const payment = await Payment.create({ appointmentId: a._id, patientCNIC: a.patientCNIC, doctorCNIC: a.doctorCNIC, amount: fee, provider, txnRef: newTxnRef() });
    return res.status(201).json({ payment, checkout: { redirect: `/pay/test/${payment.txnRef}` } });
  }
  if (provider !== 'safepay') return res.status(400).json({ error: 'That payment method is not available' });

  const { account } = await accountForDoctor(a.doctorCNIC);
  if (!account) return res.status(400).json({ error: 'This clinic does not take online payments yet. Pay at the clinic.' });
  const secret = decrypt(account.secretKeyEnc);
  const [tracker, tbt] = await Promise.all([safepay.createTracker(account, secret, fee), safepay.passportToken(account, secret)]);
  const payment = await Payment.create({
    appointmentId: a._id, patientCNIC: a.patientCNIC, doctorCNIC: a.doctorCNIC, amount: fee, provider: 'safepay',
    txnRef: newTxnRef(), accountId: account._id, environment: account.environment, tracker,
  });
  const api = API_URL(req);
  const url = safepay.checkoutUrl(account, {
    tracker,
    tbt,
    redirectUrl: `${api}/payments/safepay/return/${payment.txnRef}`,
    cancelUrl: `${api}/payments/safepay/cancel/${payment.txnRef}`,
  });
  res.status(201).json({ payment, checkout: { url } });
});

// Safepay sends the browser back here. Whatever the query says, we confirm the order's state with
// Safepay directly (server to server, with the merchant secret) before marking it paid.
const safepayReturn = expressAsyncHandler(async (req, res) => {
  const payment = await Payment.findOne({ txnRef: req.params.txnRef, provider: 'safepay' });
  if (payment && payment.status === 'initiated') await settlePending({ _id: payment._id }, 0);
  res.redirect(303, `${APP_URL()}/payments/result?ref=${encodeURIComponent(req.params.txnRef)}`);
});

const safepayCancel = expressAsyncHandler(async (req, res) => {
  const payment = await Payment.findOne({ txnRef: req.params.txnRef, provider: 'safepay' });
  if (payment && payment.status === 'initiated') {
    payment.status = 'cancelled';
    payment.message = 'Cancelled at checkout';
    await payment.save();
  }
  res.redirect(303, `${APP_URL()}/payments/result?ref=${encodeURIComponent(req.params.txnRef)}`);
});

// POST /payments/safepay/webhook/:accountId  (raw JSON body, X-SFPY-SIGNATURE header)
const safepayWebhook = expressAsyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.accountId)) return res.status(404).end();
  const account = await PaymentAccount.findById(req.params.accountId);
  if (!account) return res.status(404).end();
  const raw = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : '';
  let body;
  try {
    body = JSON.parse(raw);
  } catch {
    return res.status(400).json({ error: 'Invalid JSON' });
  }
  if (!safepay.verifyWebhook(decrypt(account.webhookSecretEnc), raw, body, req.get('x-sfpy-signature'))) {
    return res.status(401).json({ error: 'Bad signature' });
  }
  const tracker = body?.data?.tracker?.token || body?.data?.tracker || body?.data?.token || body?.tracker;
  const payment = tracker && (await Payment.findOne({ tracker: String(tracker), accountId: account._id }));
  if (payment && payment.status === 'initiated' && safepay.isPaidState(body)) {
    await markPaid(payment, body?.data?.reference || String(tracker), 'Paid with Safepay (webhook)');
  }
  res.status(200).json({ received: true });
});

// Ask Safepay about payments still waiting (browser closed before returning). Used by the daily job and on demand.
// minAgeMs gives the patient time to finish checking out before the daily job asks
const settlePending = async (filter = {}, minAgeMs = 2 * 60 * 1000) => {
  const pending = await Payment.find({ provider: 'safepay', status: 'initiated', createdAt: { $lt: new Date(Date.now() - minAgeMs), $gt: new Date(Date.now() - 7 * 86400000) }, ...filter }).limit(50);
  let settled = 0;
  for (const payment of pending) {
    try {
      const account = await PaymentAccount.findById(payment.accountId);
      if (!account) continue;
      const result = await safepay.lookupPayment(account, decrypt(account.secretKeyEnc), payment.tracker);
      payment.lastCheckedAt = new Date();
      if (safepay.isPaidState(result)) {
        await markPaid(payment, payment.tracker, 'Paid with Safepay (status check)');
        settled += 1;
      } else await payment.save();
    } catch (err) {
      console.error('Safepay status check failed:', err.message);
    }
  }
  return settled;
};

const testComplete = expressAsyncHandler(async (req, res) => {
  if (!testModeEnabled()) return res.status(404).json({ error: 'Test payments are off' });
  const payment = await Payment.findOne({ txnRef: req.params.txnRef, provider: 'test', patientCNIC: req.user.cnic });
  if (!payment) return res.status(404).json({ error: 'Payment not found' });
  if (payment.status !== 'initiated') return res.status(409).json({ error: `Payment already ${payment.status}` });
  if (req.body?.success) await markPaid(payment, `TEST-${Date.now()}`, 'Simulated payment (no money moved)');
  else {
    payment.status = 'cancelled';
    payment.message = 'Cancelled in the test checkout';
    await payment.save();
  }
  res.status(200).json({ payment });
});

// ---------- views ----------

const canSee = async (user, payment) => {
  if (user.role === 'patient') return payment.patientCNIC === user.cnic;
  if (user.role === 'doctor') return payment.doctorCNIC === user.cnic;
  if (user.role === 'staff' && user.clinicId) {
    const clinic = await Clinic.findById(user.clinicId).lean();
    return Boolean(clinic?.doctors.some((d) => d.status === 'active' && d.doctorCNIC === payment.doctorCNIC));
  }
  return false;
};

const byRef = expressAsyncHandler(async (req, res) => {
  const ref = req.params.txnRef;
  const payment = await Payment.findOne(mongoose.isValidObjectId(ref) ? { _id: ref } : { txnRef: ref });
  if (!payment || !(await canSee(req.user, payment))) return res.status(404).json({ error: 'Payment not found' });
  // a patient coming back from checkout: if it's still waiting, ask Safepay right away
  if (payment.provider === 'safepay' && payment.status === 'initiated' && req.query.check) await settlePending({ _id: payment._id }, 0);
  const fresh = await Payment.findById(payment._id).lean();
  const [appointment, doctor] = await Promise.all([
    Appointment.findById(fresh.appointmentId).lean(),
    Doctor.findOne({ doctorCNIC: fresh.doctorCNIC }).select('firstName lastName hospital specialization clinicAddress').lean(),
  ]);
  delete fresh.tracker;
  res.status(200).json({ payment: fresh, appointment, doctor });
});

const mine = expressAsyncHandler(async (req, res) => {
  const payments = await Payment.find({ patientCNIC: req.user.cnic, status: { $in: ['paid', 'refund_due', 'refunded'] } }).sort({ paidAt: -1 }).limit(100).lean();
  res.status(200).json(payments.map(({ tracker, ...p }) => p));
});

// GET /payments/options?ids=a,b -> { [appointmentId]: ['safepay', 'test'] } for the patient's own appointments
const options = expressAsyncHandler(async (req, res) => {
  const ids = String(req.query.ids || '').split(',').filter((id) => mongoose.isValidObjectId(id)).slice(0, 100);
  const appts = await Appointment.find({ _id: { $in: ids }, patientCNIC: req.user.cnic }).select('doctorCNIC').lean();
  res.status(200).json(await onlineOptions(appts));
});

// ---------- refunds ----------

// When a paid appointment is cancelled: the clinic owes the patient a refund
const flagRefund = async (appointment) => {
  if (appointment.payment?.status !== 'paid' || !['safepay', 'test', 'jazzcash'].includes(appointment.payment.method)) return;
  appointment.payment.status = 'refund_due';
  if (appointment.payment.paymentId) await Payment.updateOne({ _id: appointment.payment.paymentId }, { status: 'refund_due' });
  notify('doctor', appointment.doctorCNIC, { type: 'payment', title: 'Refund due', body: `The paid appointment on ${describe(appointment)} was cancelled. Refund Rs ${appointment.fee} from your Safepay dashboard, then mark it refunded.`, link: `/appointments/fetch/${appointment.doctorCNIC}` });
  notify('patient', appointment.patientCNIC, { type: 'payment', title: 'Refund on its way', body: `Your Rs ${appointment.fee} payment for ${describe(appointment)} will be refunded by the clinic.`, link: `/appointments/mine/${appointment.patientCNIC}` });
};

// POST /payments/:id/refunded { note } (doctor or their clinic's front desk, after refunding in Safepay)
const markRefunded = expressAsyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: 'Payment not found' });
  const payment = await Payment.findById(req.params.id);
  if (!payment || req.user.role === 'patient' || !(await canSee(req.user, payment))) return res.status(404).json({ error: 'Payment not found' });
  if (payment.status !== 'refund_due') return res.status(409).json({ error: 'No refund is due for this payment' });
  payment.status = 'refunded';
  payment.refundedAt = new Date();
  payment.refundNote = String(req.body?.note || '').slice(0, 200);
  await payment.save();
  await Appointment.updateOne({ _id: payment.appointmentId }, { 'payment.status': 'refunded' });
  notify('patient', payment.patientCNIC, { type: 'payment', title: 'Refund sent', body: `Your Rs ${payment.amount} refund has been sent. It can take a few working days to appear.`, link: `/appointments/mine/${payment.patientCNIC}` });
  res.status(200).json({ message: 'Marked as refunded', payment });
});

// ---------- connecting a merchant account ----------

// Who may manage which account: a solo doctor their own; a clinic admin their clinic's
const resolveOwner = async (req, res) => {
  if (req.params.scope === 'doctor') return { ownerType: 'doctor', ownerId: String(req.user.cnic) };
  if (req.params.scope === 'clinic' && mongoose.isValidObjectId(req.params.id)) {
    const clinic = await Clinic.findById(req.params.id);
    const me = clinic?.doctors.find((d) => d.doctorCNIC === req.user.cnic && d.status === 'active');
    if (me?.role === 'admin') return { ownerType: 'clinic', ownerId: String(clinic._id) };
  }
  res.status(403).json({ error: 'Only clinic admins can manage the clinic payment account' });
  return null;
};

const accountView = (acc, req) => acc && {
  ...acc.toJSON(),
  secretKeyHint: mask(decrypt(acc.secretKeyEnc)),
  hasWebhookSecret: Boolean(acc.webhookSecretEnc),
  webhookUrl: `${API_URL(req)}/payments/safepay/webhook/${acc._id}`,
};

// GET /payments/account/doctor  |  /payments/account/clinic/:id
const getAccount = expressAsyncHandler(async (req, res) => {
  const owner = await resolveOwner(req, res);
  if (!owner) return;
  const acc = await PaymentAccount.findOne(owner);
  let clinicAccount = null;
  if (owner.ownerType === 'doctor') {
    // a doctor in a clinic with its own account is paid through the clinic
    const via = await accountForDoctor(req.user.cnic);
    if (via.account && via.account.ownerType === 'clinic') clinicAccount = { payee: via.payee };
  }
  res.status(200).json({ account: accountView(acc, req), clinicAccount });
});

// PUT { environment, publicKey, secretKey?, webhookSecret?, enabled }
const saveAccount = expressAsyncHandler(async (req, res) => {
  const owner = await resolveOwner(req, res);
  if (!owner) return;
  const { environment = 'sandbox', publicKey, secretKey, webhookSecret, enabled = true } = req.body || {};
  if (!['sandbox', 'production'].includes(environment)) return res.status(400).json({ error: 'Choose sandbox or production' });
  if (!String(publicKey || '').trim()) return res.status(400).json({ error: 'Enter your Safepay public (API) key' });
  let acc = await PaymentAccount.findOne(owner);
  if (!acc && !String(secretKey || '').trim()) return res.status(400).json({ error: 'Enter your Safepay secret key' });

  // check both keys really work together by opening a test order (never charged)
  const candidate = { environment, publicKey: String(publicKey).trim() };
  const secretToCheck = String(secretKey || '').trim() || decrypt(acc?.secretKeyEnc);
  try {
    await safepay.createTracker(candidate, secretToCheck, 500);
  } catch (err) {
    const which = err.status === 401 || err.status === 403 ? 'secret key' : 'keys';
    return res.status(400).json({ error: `Safepay did not accept these ${which} for ${environment === 'production' ? 'live' : 'sandbox'} mode (${err.message}). Check you copied them from the right Safepay environment.` });
  }
  if (!acc) acc = new PaymentAccount({ ...owner });
  acc.environment = environment;
  acc.publicKey = candidate.publicKey;
  if (String(secretKey || '').trim()) acc.secretKeyEnc = encrypt(String(secretKey).trim());
  if (webhookSecret !== undefined) acc.webhookSecretEnc = String(webhookSecret).trim() ? encrypt(String(webhookSecret).trim()) : undefined;
  acc.enabled = Boolean(enabled);
  acc.verifiedAt = new Date();
  acc.lastError = undefined;
  acc.updatedBy = req.user.cnic;
  await acc.save();
  res.status(200).json({ message: environment === 'production' ? 'Safepay connected. Patients can now pay online.' : 'Safepay sandbox connected. Payments are test-only until you switch to production.', account: accountView(acc, req) });
});

const removeAccount = expressAsyncHandler(async (req, res) => {
  const owner = await resolveOwner(req, res);
  if (!owner) return;
  await PaymentAccount.deleteOne(owner);
  res.status(200).json({ message: 'Safepay disconnected. Patients will pay at the clinic.' });
});

module.exports = {
  checkout, safepayReturn, safepayCancel, safepayWebhook, settlePending, testComplete, byRef, mine, options,
  flagRefund, markRefunded, getAccount, saveAccount, removeAccount, markPaid,
};
