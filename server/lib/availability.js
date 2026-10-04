// Doctor clinic hours -> bookable time slots

const DEFAULT = {
  slotMinutes: 30,
  days: [1, 2, 3, 4, 5, 6].map((day) => ({ day, start: '09:00', end: '17:00' })),
  holidays: [],
  videoConsults: false,
};

const toMin = (t) => {
  const [h, m] = String(t).split(':').map(Number);
  return h * 60 + m;
};
const toTime = (min) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

const scheduleOf = (doctor) => {
  const a = doctor?.availability || {};
  return {
    slotMinutes: a.slotMinutes || DEFAULT.slotMinutes,
    days: a.days?.length ? a.days : DEFAULT.days,
    holidays: a.holidays || [],
    videoConsults: Boolean(a.videoConsults),
    custom: Boolean(a.days?.length),
  };
};

// "YYYY-MM-DD" -> ['09:00', '09:30', ...]; [] when closed that day
const slotsFor = (doctor, date) => {
  const s = scheduleOf(doctor);
  if (s.holidays.includes(date)) return [];
  const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
  const out = [];
  for (const block of s.days.filter((d) => d.day === weekday)) {
    for (let m = toMin(block.start); m + s.slotMinutes <= toMin(block.end); m += s.slotMinutes) out.push(toTime(m));
  }
  return [...new Set(out)].sort();
};

const isTimeStr = (t) => /^([01]\d|2[0-3]):[0-5]\d$/.test(String(t));

// Validates and normalises a schedule sent by the doctor
const cleanSchedule = (input = {}) => {
  const slotMinutes = Number(input.slotMinutes) || 30;
  if (![10, 15, 20, 30, 45, 60].includes(slotMinutes)) throw new Error('Slot length must be 10, 15, 20, 30, 45 or 60 minutes');
  const days = (Array.isArray(input.days) ? input.days : []).slice(0, 21).map((d) => {
    const day = Number(d.day);
    if (!(day >= 0 && day <= 6) || !isTimeStr(d.start) || !isTimeStr(d.end) || toMin(d.end) <= toMin(d.start)) {
      throw new Error('Each working block needs a day and a start time before its end time');
    }
    return { day, start: d.start, end: d.end };
  });
  if (!days.length) throw new Error('Add at least one working day');
  const holidays = [...new Set((Array.isArray(input.holidays) ? input.holidays : []).filter((h) => /^\d{4}-\d{2}-\d{2}$/.test(h)))].sort().slice(-120);
  return { slotMinutes, days, holidays, videoConsults: Boolean(input.videoConsults) };
};

module.exports = { DEFAULT, scheduleOf, slotsFor, cleanSchedule };

// ---------- hospital memberships: a schedule per branch ----------

const isTime24 = (t) => /^([01]\d|2[0-3]):[0-5]\d$/.test(String(t));

// Open slots for a doctor at one branch of an organization on "YYYY-MM-DD"
const membershipSlots = (membership, facilityId, date) => {
  const a = membership?.availability || {};
  if ((a.holidays || []).includes(date)) return [];
  const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
  const len = a.slotMinutes || 30;
  const out = [];
  for (const b of (a.blocks || []).filter((x) => String(x.facilityId) === String(facilityId) && x.day === weekday)) {
    for (let m = toMin(b.start); m + len <= toMin(b.end); m += len) out.push(toTime(m));
  }
  return [...new Set(out)].sort();
};

// Validates a membership schedule; every block must be at one of the membership's branches
const cleanMembershipSchedule = (input = {}, allowedFacilityIds = []) => {
  const slotMinutes = Number(input.slotMinutes) || 30;
  if (![10, 15, 20, 30, 45, 60].includes(slotMinutes)) throw new Error('Slot length must be 10, 15, 20, 30, 45 or 60 minutes');
  const allowed = allowedFacilityIds.map(String);
  const blocks = (Array.isArray(input.blocks) ? input.blocks : []).slice(0, 60).map((b) => {
    const day = Number(b.day);
    if (!allowed.includes(String(b.facilityId))) throw new Error('Each time block must be at one of this doctor\'s branches');
    if (!(day >= 0 && day <= 6) || !isTime24(b.start) || !isTime24(b.end) || toMin(b.end) <= toMin(b.start)) {
      throw new Error('Each time block needs a day and a start time before its end time');
    }
    return { facilityId: b.facilityId, day, start: b.start, end: b.end };
  });
  const holidays = [...new Set((Array.isArray(input.holidays) ? input.holidays : []).filter((h) => /^\d{4}-\d{2}-\d{2}$/.test(h)))].sort().slice(-120);
  return { slotMinutes, blocks, holidays, videoConsults: Boolean(input.videoConsults) };
};

module.exports.membershipSlots = membershipSlots;
module.exports.cleanMembershipSchedule = cleanMembershipSchedule;
