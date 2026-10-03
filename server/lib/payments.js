// Who gets paid, and how. Option B: fees go straight to the clinic's (or solo doctor's) own
// Safepay merchant account. PAYMENTS_TEST_MODE=1 adds a simulated checkout for demos.

const crypto = require('crypto');
const PaymentAccount = require('../models/PaymentAccountModel');
const Clinic = require('../models/ClinicModel');

const testModeEnabled = () => process.env.PAYMENTS_TEST_MODE === '1';

const newTxnRef = () => `PMR${Date.now()}${crypto.randomBytes(2).toString('hex').toUpperCase()}`;

// The account that receives a doctor's fees: their clinic's, if the clinic has connected one, else their own
const accountForDoctor = async (doctorCNIC) => {
  const clinic = await Clinic.findOne({ doctors: { $elemMatch: { doctorCNIC: Number(doctorCNIC), status: 'active' } } }).select('_id name').lean();
  if (clinic) {
    const clinicAccount = await PaymentAccount.findOne({ ownerType: 'clinic', ownerId: String(clinic._id), enabled: true });
    if (clinicAccount) return { account: clinicAccount, payee: clinic.name };
  }
  const own = await PaymentAccount.findOne({ ownerType: 'doctor', ownerId: String(doctorCNIC), enabled: true });
  return own ? { account: own, payee: null } : { account: null, payee: null };
};

// Ways the patient can pay online for these appointments: { [appointmentId]: ['safepay', 'test'] }
const onlineOptions = async (appointments) => {
  const byDoctor = {};
  for (const cnic of [...new Set(appointments.map((a) => a.doctorCNIC))]) {
    byDoctor[cnic] = Boolean((await accountForDoctor(cnic)).account);
  }
  return Object.fromEntries(appointments.map((a) => [String(a._id), [
    ...(byDoctor[a.doctorCNIC] ? ['safepay'] : []),
    ...(testModeEnabled() ? ['test'] : []),
  ]]));
};

module.exports = { testModeEnabled, newTxnRef, accountForDoctor, onlineOptions };
