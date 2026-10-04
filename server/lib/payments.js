// Who gets paid, and how. Option B: fees go straight to the merchant account of whoever provides
// the visit: the hospital (organization) for visits at its branches, the doctor for their private
// practice. PAYMENTS_TEST_MODE=1 adds a simulated checkout for demos.

const crypto = require('crypto');
const PaymentAccount = require('../models/PaymentAccountModel');
const Organization = require('../models/OrganizationModel');

const testModeEnabled = () => process.env.PAYMENTS_TEST_MODE === '1';

const newTxnRef = () => `PMR${Date.now()}${crypto.randomBytes(2).toString('hex').toUpperCase()}`;

// The account that receives an appointment's fee
const accountForAppointment = async (appointment) => {
  if (appointment.orgId) {
    const org = await Organization.findById(appointment.orgId).select('name').lean();
    const account = await PaymentAccount.findOne({ ownerType: 'clinic', ownerId: String(appointment.orgId), enabled: true });
    return { account: account || null, payee: org?.name || null };
  }
  const own = await PaymentAccount.findOne({ ownerType: 'doctor', ownerId: String(appointment.doctorCNIC), enabled: true });
  return { account: own || null, payee: null };
};

// Ways the patient can pay online for these appointments: { [appointmentId]: ['safepay', 'test'] }
const onlineOptions = async (appointments) => {
  const out = {};
  for (const a of appointments) {
    const { account } = await accountForAppointment(a);
    out[String(a._id)] = [...(account ? ['safepay'] : []), ...(testModeEnabled() ? ['test'] : [])];
  }
  return out;
};

module.exports = { testModeEnabled, newTxnRef, accountForAppointment, onlineOptions };
