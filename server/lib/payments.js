// Online consultation-fee payments.
//   JazzCash hosted checkout (mobile wallet or card): JAZZCASH_MERCHANT_ID, JAZZCASH_PASSWORD,
//     JAZZCASH_INTEGRITY_SALT, optional JAZZCASH_URL (defaults to the sandbox).
//   Test mode (PAYMENTS_TEST_MODE=1): a clearly-labelled simulated checkout where no money moves.

const crypto = require('crypto');

const SANDBOX_URL = 'https://sandbox.jazzcash.com.pk/CustomerPortal/transactionmanagement/merchantform/';

const jazzcashEnabled = () =>
  Boolean(process.env.JAZZCASH_MERCHANT_ID && process.env.JAZZCASH_PASSWORD && process.env.JAZZCASH_INTEGRITY_SALT);
const testModeEnabled = () => process.env.PAYMENTS_TEST_MODE === '1';

const providers = () => [
  ...(jazzcashEnabled() ? ['jazzcash'] : []),
  ...(testModeEnabled() ? ['test'] : []),
];

// yyyyMMddHHmmss in Pakistan time
const pktStamp = (date) => {
  const p = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Karachi', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).formatToParts(date).reduce((a, x) => ({ ...a, [x.type]: x.value }), {});
  return `${p.year}${p.month}${p.day}${p.hour === '24' ? '00' : p.hour}${p.minute}${p.second}`;
};

// HMAC-SHA256 over the integrity salt and all non-empty pp_ fields in alphabetical order
const jazzcashHash = (fields) => {
  const salt = process.env.JAZZCASH_INTEGRITY_SALT;
  const values = Object.keys(fields)
    .filter((k) => k.toLowerCase().startsWith('pp') && k !== 'pp_SecureHash' && fields[k] !== '' && fields[k] != null)
    .sort()
    .map((k) => fields[k]);
  return crypto.createHmac('sha256', salt).update([salt, ...values].join('&')).digest('hex').toUpperCase();
};

// Form fields the browser posts to JazzCash
const jazzcashCheckout = (payment, returnUrl) => {
  const now = new Date();
  const fields = {
    pp_Version: '1.1',
    pp_TxnType: process.env.JAZZCASH_TXN_TYPE || '',
    pp_Language: 'EN',
    pp_MerchantID: process.env.JAZZCASH_MERCHANT_ID,
    pp_SubMerchantID: '',
    pp_Password: process.env.JAZZCASH_PASSWORD,
    pp_BankID: '',
    pp_ProductID: '',
    pp_TxnRefNo: payment.txnRef,
    pp_Amount: String(Math.round(payment.amount * 100)),
    pp_TxnCurrency: 'PKR',
    pp_TxnDateTime: pktStamp(now),
    pp_BillReference: `appt${String(payment.appointmentId).slice(-12)}`,
    pp_Description: 'Consultation fee - PakMedRecord',
    pp_TxnExpiryDateTime: pktStamp(new Date(now.getTime() + 24 * 3600 * 1000)),
    pp_ReturnURL: returnUrl,
    ppmpf_1: String(payment._id),
  };
  fields.pp_SecureHash = jazzcashHash(fields);
  return { action: process.env.JAZZCASH_URL || SANDBOX_URL, method: 'POST', fields };
};

// Checks the hash JazzCash posts back; returns { valid, paid, ref, message }
const jazzcashVerify = (body) => {
  const valid = jazzcashEnabled() && Boolean(body.pp_SecureHash) && jazzcashHash(body) === String(body.pp_SecureHash).toUpperCase();
  return {
    valid,
    paid: valid && body.pp_ResponseCode === '000',
    txnRef: body.pp_TxnRefNo,
    providerRef: body.pp_RetreivalReferenceNo || body.pp_AuthCode || '',
    message: body.pp_ResponseMessage || '',
  };
};

const newTxnRef = () => `PMR${Date.now()}${crypto.randomBytes(2).toString('hex').toUpperCase()}`;

module.exports = { providers, jazzcashEnabled, testModeEnabled, jazzcashCheckout, jazzcashVerify, jazzcashHash, newTxnRef };
