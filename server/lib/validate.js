// Small input validators shared by controllers

const isCNIC = (value) => /^\d{13}$/.test(String(value ?? ''));
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

module.exports = { isCNIC, isEmail, isFutureDay, isTime, cleanList };
