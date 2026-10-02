// Pakistan-time date helpers (the app's users are in PKT, servers run in UTC)

const pktDate = (d = new Date()) => d.toLocaleDateString('en-CA', { timeZone: 'Asia/Karachi' });
const addDays = (ymd, n) => {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const ageYears = (dob) => (dob ? Math.floor((Date.now() - new Date(dob)) / 3.15576e10) : null);

module.exports = { pktDate, addDays, ageYears };
