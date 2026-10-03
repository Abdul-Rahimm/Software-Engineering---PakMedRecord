// Admin: every payment on the platform, commission earned, and monthly platform-fee invoices.

const mongoose = require('mongoose');
const expressAsyncHandler = require('express-async-handler');
const Payment = require('../models/PaymentModel');
const Invoice = require('../models/InvoiceModel');
const Patient = require('../models/PatientModel');
const Doctor = require('../models/DoctorModel');
const { applyCommission, commissionRate, roundRs } = require('../lib/commission');
const { mailEnabled, sendMail, brandedEmail } = require('../lib/mailer');
const { APP_URL } = require('../lib/accounts');

// Calendar months in Pakistan time
const isMonth = (m) => /^\d{4}-(0[1-9]|1[0-2])$/.test(String(m || ''));
const thisMonth = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Karachi' }).slice(0, 7);
const monthRange = (m) => {
  const [y, mo] = m.split('-').map(Number);
  const next = mo === 12 ? `${y + 1}-01` : `${y}-${String(mo + 1).padStart(2, '0')}`;
  return { $gte: new Date(`${m}-01T00:00:00+05:00`), $lt: new Date(`${next}-01T00:00:00+05:00`) };
};
const envFilter = (env) => (env === 'sandbox' || env === 'production' ? { environment: env } : {});

// Older online payments made before commission tracking get their payee/commission filled in
const backfill = async () => {
  const missing = await Payment.find({ provider: 'safepay', status: { $in: ['paid', 'refund_due', 'refunded'] }, commissionAmount: { $exists: false } }).limit(200);
  for (const p of missing) {
    await applyCommission(p);
    if (p.status === 'refunded') p.commissionAmount = 0;
    await p.save();
  }
};

// Only fees that stayed paid earn commission (refunds don't)
const COMMISSIONABLE = { provider: 'safepay', status: 'paid' };

// GET /admin/billing/summary?month=YYYY-MM&env=
const summary = expressAsyncHandler(async (req, res) => {
  await backfill();
  const month = isMonth(req.query.month) ? req.query.month : thisMonth();
  const env = req.query.env || 'all';
  const inMonth = { paidAt: monthRange(month), ...envFilter(env) };

  const [online, allPaid, refunded, invoices, payees] = await Promise.all([
    Payment.aggregate([{ $match: { ...COMMISSIONABLE, ...inMonth } }, { $group: { _id: null, count: { $sum: 1 }, gross: { $sum: '$amount' }, commission: { $sum: '$commissionAmount' } } }]),
    Payment.aggregate([{ $match: { status: { $in: ['paid', 'refund_due', 'refunded'] }, provider: { $ne: 'test' }, paidAt: monthRange(month) } }, { $group: { _id: '$provider', count: { $sum: 1 }, amount: { $sum: '$amount' } } }]),
    Payment.aggregate([{ $match: { provider: 'safepay', status: { $in: ['refund_due', 'refunded'] }, ...inMonth } }, { $group: { _id: null, count: { $sum: 1 }, amount: { $sum: '$amount' } } }]),
    Invoice.aggregate([{ $match: { status: { $ne: 'void' }, ...envFilter(env) } }, { $group: { _id: '$status', count: { $sum: 1 }, amount: { $sum: '$commissionAmount' } } }]),
    Payment.aggregate([
      { $match: { ...COMMISSIONABLE, ...inMonth } },
      { $group: {
        _id: { type: '$payee.type', id: '$payee.id', env: '$environment' },
        name: { $last: '$payee.name' },
        count: { $sum: 1 },
        gross: { $sum: '$amount' },
        commission: { $sum: '$commissionAmount' },
        uninvoicedCount: { $sum: { $cond: [{ $ifNull: ['$invoiceId', false] }, 0, 1] } },
        uninvoiced: { $sum: { $cond: [{ $ifNull: ['$invoiceId', false] }, 0, '$commissionAmount'] } },
      } },
      { $sort: { commission: -1 } },
    ]),
  ]);
  const byStatus = Object.fromEntries(invoices.map((i) => [i._id, i]));
  res.status(200).json({
    month,
    env,
    commissionRate: commissionRate(),
    online: { count: online[0]?.count || 0, gross: roundRs(online[0]?.gross || 0), commission: roundRs(online[0]?.commission || 0) },
    refunded: { count: refunded[0]?.count || 0, amount: roundRs(refunded[0]?.amount || 0) },
    byMethod: allPaid.map((m) => ({ method: m._id, count: m.count, amount: roundRs(m.amount) })),
    invoices: {
      open: { count: byStatus.open?.count || 0, amount: roundRs(byStatus.open?.amount || 0) },
      paid: { count: byStatus.paid?.count || 0, amount: roundRs(byStatus.paid?.amount || 0) },
    },
    payees: payees.map((p) => ({
      type: p._id.type, id: p._id.id, environment: p._id.env, name: p.name, count: p.count,
      gross: roundRs(p.gross), commission: roundRs(p.commission), uninvoicedCount: p.uninvoicedCount, uninvoiced: roundRs(p.uninvoiced),
    })),
  });
});

// GET /admin/billing/payments?month=&env=&status=&method=&q=
const payments = expressAsyncHandler(async (req, res) => {
  await backfill();
  const filter = {};
  if (isMonth(req.query.month)) filter.createdAt = monthRange(req.query.month);
  Object.assign(filter, envFilter(req.query.env));
  if (['initiated', 'paid', 'failed', 'cancelled', 'refund_due', 'refunded'].includes(req.query.status)) filter.status = req.query.status;
  if (['safepay', 'clinic', 'test'].includes(req.query.method)) filter.provider = req.query.method;
  const q = String(req.query.q || '').trim();
  if (q) {
    const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [{ txnRef: rx }, { 'payee.name': rx }, ...(/^\d{5,13}$/.test(q.replace(/-/g, '')) ? [{ patientCNIC: Number(q.replace(/-/g, '')) }, { doctorCNIC: Number(q.replace(/-/g, '')) }] : [])];
  }
  const list = await Payment.find(filter).sort({ createdAt: -1 }).limit(300).select('-tracker').lean();
  const [patients, doctors] = await Promise.all([
    Patient.find({ patientCNIC: { $in: [...new Set(list.map((p) => p.patientCNIC))] } }).select('patientCNIC firstName lastName').lean(),
    Doctor.find({ doctorCNIC: { $in: [...new Set(list.map((p) => p.doctorCNIC))] } }).select('doctorCNIC firstName lastName').lean(),
  ]);
  const name = (arr, key, cnic, prefix = '') => { const x = arr.find((y) => y[key] === cnic); return x ? `${prefix}${x.firstName} ${x.lastName}` : '—'; };
  res.status(200).json(list.map((p) => ({
    ...p,
    patientName: name(patients, 'patientCNIC', p.patientCNIC),
    doctorName: name(doctors, 'doctorCNIC', p.doctorCNIC, 'Dr. '),
  })));
});

const nextNumber = async (period) => {
  const count = await Invoice.countDocuments({ period });
  return `PMR-${period}-${String(count + 1).padStart(4, '0')}`;
};

const invoiceEmail = (inv) => brandedEmail({
  subject: `PakMedRecord platform fee invoice ${inv.number}`,
  name: inv.payee.name,
  paragraphs: [
    `Here is your PakMedRecord platform fee for ${new Date(`${inv.period}-01T00:00:00Z`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' })}.`,
    `${inv.paymentCount} online consultation fee${inv.paymentCount === 1 ? '' : 's'} totalling Rs ${inv.grossAmount.toLocaleString('en-PK')} were paid into your Safepay account. The ${commissionRate()}% platform fee is Rs ${inv.commissionAmount.toLocaleString('en-PK')}, due by ${inv.dueAt.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}.`,
    inv.environment === 'sandbox' ? 'This invoice covers sandbox (test) payments only. Nothing is owed.' : 'Reply to this email for payment details. The invoice and its payments are listed under Online payments in PakMedRecord.',
  ],
  button: { label: 'View in PakMedRecord', link: `${APP_URL()}/doctor/signin` },
});

// POST /admin/billing/invoices { payeeType, payeeId, period, environment }
const createInvoice = expressAsyncHandler(async (req, res) => {
  const { payeeType, payeeId, period, environment = 'production' } = req.body || {};
  if (!['clinic', 'doctor'].includes(payeeType) || !payeeId || !isMonth(period)) return res.status(400).json({ error: 'Choose a clinic or doctor and a month' });
  const due = await Payment.find({ ...COMMISSIONABLE, 'payee.type': payeeType, 'payee.id': String(payeeId), environment, paidAt: monthRange(period), invoiceId: { $exists: false } });
  if (!due.length) return res.status(409).json({ error: 'Nothing left to invoice for this month' });
  const commission = roundRs(due.reduce((s, p) => s + (p.commissionAmount || 0), 0));
  const gross = roundRs(due.reduce((s, p) => s + p.amount, 0));
  const [y, m] = period.split('-').map(Number);
  const dueAt = new Date(Date.UTC(m === 12 ? y + 1 : y, m === 12 ? 0 : m, 15));
  const invoice = await Invoice.create({
    number: await nextNumber(period),
    payee: due[0].payee,
    period, environment,
    payments: due.map((p) => p._id),
    paymentCount: due.length,
    grossAmount: gross,
    commissionAmount: commission,
    dueAt,
    createdBy: req.user.id,
  });
  await Payment.updateMany({ _id: { $in: due.map((p) => p._id) } }, { invoiceId: invoice._id });
  let emailed = false;
  if (mailEnabled() && invoice.payee.email) {
    try {
      await sendMail({ to: invoice.payee.email, ...invoiceEmail(invoice) });
      emailed = true;
    } catch (err) {
      console.error('Invoice email failed:', err.message);
    }
  }
  res.status(201).json({ message: emailed ? `Invoice ${invoice.number} created and emailed` : `Invoice ${invoice.number} created`, invoice });
});

const listInvoices = expressAsyncHandler(async (req, res) => {
  const filter = { ...envFilter(req.query.env) };
  if (['open', 'paid', 'void'].includes(req.query.status)) filter.status = req.query.status;
  res.status(200).json(await Invoice.find(filter).sort({ createdAt: -1 }).limit(200).select('-payments').lean());
});

// POST /admin/billing/invoices/:id { action: 'paid' | 'void' | 'reopen', note }
const updateInvoice = expressAsyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: 'Invoice not found' });
  const inv = await Invoice.findById(req.params.id);
  if (!inv) return res.status(404).json({ error: 'Invoice not found' });
  const { action, note } = req.body || {};
  if (action === 'paid') {
    if (inv.status !== 'open') return res.status(409).json({ error: `Invoice is ${inv.status}` });
    inv.status = 'paid';
    inv.paidAt = new Date();
    inv.paidNote = String(note || '').slice(0, 200);
  } else if (action === 'void') {
    if (inv.status === 'void') return res.status(409).json({ error: 'Already void' });
    inv.status = 'void';
    // free its payments so they can be invoiced again (e.g. after a correction)
    await Payment.updateMany({ invoiceId: inv._id }, { $unset: { invoiceId: 1 } });
  } else if (action === 'reopen') {
    if (inv.status !== 'paid') return res.status(409).json({ error: 'Only paid invoices can be reopened' });
    inv.status = 'open';
    inv.paidAt = undefined;
  } else return res.status(400).json({ error: 'Unknown action' });
  await inv.save();
  res.status(200).json({ message: `Invoice ${inv.number} ${inv.status === 'open' ? 'reopened' : `marked ${inv.status}`}`, invoice: inv });
});

module.exports = { summary, payments, createInvoice, listInvoices, updateInvoice };
