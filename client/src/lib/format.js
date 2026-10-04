// Display helpers shared across pages

// 4210112345671 -> 42101-1234567-1
export const formatCNIC = (cnic) => {
  const s = String(cnic ?? '').replace(/\D/g, '');
  if (s.length !== 13) return String(cnic ?? '');
  return `${s.slice(0, 5)}-${s.slice(5, 12)}-${s.slice(12)}`;
};

// Accepts "42101-1234567-1" or digits; returns 13 digits or ''
export const parseCNIC = (value) => String(value ?? '').replace(/\D/g, '').slice(0, 13);

export const isValidCNIC = (value) => parseCNIC(value).length === 13;

// Same rules as the server (NADRA layout): region digit 1-8, gender digit odd = male, even = female.
// Catches typos only; it can't prove the CNIC was issued.
export const cnicProblem = (value, gender) => {
  const s = parseCNIC(value);
  if (s.length !== 13) return 'CNIC must be 13 digits';
  if (s[0] === '0' || s[0] === '9') return 'NADRA numbers start with 1 to 8; please check it';
  if (/^(\d)\1{12}$/.test(s)) return 'This CNIC number is not valid';
  const odd = Number(s[12]) % 2 === 1;
  if (gender === 'Male' && !odd) return 'For men the last digit is odd. Check the number or gender';
  if (gender === 'Female' && odd) return 'For women the last digit is even. Check the number or gender';
  return null;
};

// Live-format CNIC while typing
export const maskCNIC = (value) => {
  const s = parseCNIC(value);
  if (s.length <= 5) return s;
  if (s.length <= 12) return `${s.slice(0, 5)}-${s.slice(5)}`;
  return `${s.slice(0, 5)}-${s.slice(5, 12)}-${s.slice(12)}`;
};

export const initials = (first = '', last = '') =>
  `${first?.[0] ?? ''}${last?.[0] ?? ''}`.toUpperCase() || '•';

export const fullName = (person) => (person ? `${person.firstName} ${person.lastName}` : '');

export const doctorName = (doctor) => (doctor ? `Dr. ${fullName(doctor)}` : 'Unknown doctor');

export const formatDate = (value, opts = { day: 'numeric', month: 'short', year: 'numeric' }) => {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-GB', opts);
};

export const formatDateTime = (value) => {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

// "14:30" -> "2:30 PM"
export const formatTime = (time) => {
  const [h, m] = String(time ?? '').split(':').map(Number);
  if (Number.isNaN(h)) return time ?? '';
  const suffix = h >= 12 ? 'PM' : 'AM';
  return `${((h + 11) % 12) + 1}:${String(m || 0).padStart(2, '0')} ${suffix}`;
};

export const greeting = () => {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
};

export const apiError = (error, fallback = 'Something went wrong') =>
  error?.response?.data?.error || error?.response?.data?.message || (error?.response ? fallback : 'Could not reach the server');

// Appointment dates are stored as UTC midnight of the booked day; rebuild that calendar day locally
export const apptDay = (value) => {
  const d = new Date(value);
  return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
};
