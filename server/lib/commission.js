// Platform commission on online consultation fees (paid straight to clinics, invoiced monthly).

const PaymentAccount = require('../models/PaymentAccountModel');
const Clinic = require('../models/ClinicModel');
const Doctor = require('../models/DoctorModel');

// percent of each online fee; PLATFORM_COMMISSION_PERCENT overrides
const commissionRate = () => {
  const n = Number(process.env.PLATFORM_COMMISSION_PERCENT);
  return Number.isFinite(n) && n >= 0 && n <= 50 ? n : 5;
};

const roundRs = (n) => Math.round(n * 100) / 100;

// Who received the money for this payment (the merchant account's owner), with a display name and email
const payeeOf = async (payment) => {
  const account = payment.accountId && (await PaymentAccount.findById(payment.accountId).lean());
  if (account?.ownerType === 'clinic') {
    const clinic = await Clinic.findById(account.ownerId).lean();
    const admin = clinic?.doctors.find((d) => d.role === 'admin' && d.status === 'active');
    const adminDoc = admin && (await Doctor.findOne({ doctorCNIC: admin.doctorCNIC }).select('email').lean());
    return { type: 'clinic', id: String(account.ownerId), name: clinic?.name || 'Clinic', email: adminDoc?.email };
  }
  const cnic = account?.ownerId || payment.doctorCNIC;
  const d = await Doctor.findOne({ doctorCNIC: Number(cnic) }).select('firstName lastName email').lean();
  return { type: 'doctor', id: String(cnic), name: d ? `Dr. ${d.firstName} ${d.lastName}` : 'Doctor', email: d?.email };
};

// Fill in payee + commission on a paid online payment (idempotent)
const applyCommission = async (payment) => {
  if (payment.provider !== 'safepay') return payment;
  if (!payment.payee?.id) payment.payee = await payeeOf(payment);
  if (payment.commissionRate == null) payment.commissionRate = commissionRate();
  payment.commissionAmount = roundRs((payment.amount * payment.commissionRate) / 100);
  return payment;
};

module.exports = { commissionRate, applyCommission, payeeOf, roundRs };
