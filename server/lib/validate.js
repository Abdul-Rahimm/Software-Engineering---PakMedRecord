// Small input validators shared by controllers

const isCNIC = (value) => /^\d{13}$/.test(String(value ?? ''));
// NADRA CNIC / B-Form layout: 5-digit locality code (first digit = region), 7-digit serial, gender digit
// (odd = male, even = female). This catches typos only; it can't prove the number was ever issued.
// Region digits: 1 KP, 2 ex-FATA, 3 Punjab, 4 Sindh, 5 Balochistan, 6 Islamabad, 7 Gilgit-Baltistan,
// 8 Azad Kashmir (accepted leniently). 0 and 9 are never issued.
const cnicProblem = (value, gender) => {
  const s = String(value ?? '');
  if (!/^\d{13}$/.test(s)) return 'CNIC must be 13 digits';
  if (s[0] === '0' || s[0] === '9') return 'This CNIC number is not valid. NADRA numbers start with 1 to 8; please check it.';
  if (/^(\d)\1{12}$/.test(s)) return 'This CNIC number is not valid; please check it.';
  const odd = Number(s[12]) % 2 === 1;
  if (gender === 'Male' && !odd) return 'For men the last digit of the CNIC is odd. Please check the number (or the gender you chose).';
  if (gender === 'Female' && odd) return 'For women the last digit of the CNIC is even. Please check the number (or the gender you chose).';
  return null;
};

const isEmail = (value) => /^\S+@\S+\.\S+$/.test(String(value ?? ''));

// "YYYY-MM-DD" that is today or later (server local date)
const isFutureDay = (value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value ?? ''))) return false;
  const today = new Date().toISOString().slice(0, 10);
  return value >= today;
};

const isTime = (value) => /^([01]\d|2[0-3]):[0-5]\d$/.test(String(value ?? ''));

// Trimmed, de-duplicated list of non-empty strings
const cleanList = (list, max = 30) =>
  [...new Set((Array.isArray(list) ? list : []).map((s) => String(s).trim()).filter(Boolean))].slice(0, max);

module.exports = { cnicProblem, isCNIC, isEmail, isFutureDay, isTime, cleanList };
