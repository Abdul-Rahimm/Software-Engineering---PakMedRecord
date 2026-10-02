// Pakistan Expanded Programme on Immunization (EPI) routine childhood schedule.
// Ages are in days from birth. Used to show each child's due and overdue vaccines.

const EPI_SCHEDULE = [
  { code: 'bcg', name: 'BCG', protects: 'Tuberculosis', ageDays: 0, label: 'At birth' },
  { code: 'opv0', name: 'OPV-0 (polio drops)', protects: 'Polio', ageDays: 0, label: 'At birth' },
  { code: 'hepb0', name: 'Hepatitis B (birth dose)', protects: 'Hepatitis B', ageDays: 0, label: 'At birth' },
  { code: 'opv1', name: 'OPV-1 (polio drops)', protects: 'Polio', ageDays: 42, label: '6 weeks' },
  { code: 'penta1', name: 'Pentavalent-1', protects: 'Diphtheria, tetanus, whooping cough, Hep B, Hib', ageDays: 42, label: '6 weeks' },
  { code: 'pcv1', name: 'Pneumococcal (PCV)-1', protects: 'Pneumonia, meningitis', ageDays: 42, label: '6 weeks' },
  { code: 'rota1', name: 'Rotavirus-1', protects: 'Rotavirus diarrhoea', ageDays: 42, label: '6 weeks' },
  { code: 'opv2', name: 'OPV-2 (polio drops)', protects: 'Polio', ageDays: 70, label: '10 weeks' },
  { code: 'penta2', name: 'Pentavalent-2', protects: 'Diphtheria, tetanus, whooping cough, Hep B, Hib', ageDays: 70, label: '10 weeks' },
  { code: 'pcv2', name: 'Pneumococcal (PCV)-2', protects: 'Pneumonia, meningitis', ageDays: 70, label: '10 weeks' },
  { code: 'rota2', name: 'Rotavirus-2', protects: 'Rotavirus diarrhoea', ageDays: 70, label: '10 weeks' },
  { code: 'opv3', name: 'OPV-3 (polio drops)', protects: 'Polio', ageDays: 98, label: '14 weeks' },
  { code: 'penta3', name: 'Pentavalent-3', protects: 'Diphtheria, tetanus, whooping cough, Hep B, Hib', ageDays: 98, label: '14 weeks' },
  { code: 'pcv3', name: 'Pneumococcal (PCV)-3', protects: 'Pneumonia, meningitis', ageDays: 98, label: '14 weeks' },
  { code: 'ipv1', name: 'IPV-1 (polio injection)', protects: 'Polio', ageDays: 98, label: '14 weeks' },
  { code: 'mr1', name: 'Measles-Rubella (MR)-1', protects: 'Measles, rubella', ageDays: 274, label: '9 months' },
  { code: 'tcv', name: 'Typhoid conjugate (TCV)', protects: 'Typhoid', ageDays: 274, label: '9 months' },
  { code: 'ipv2', name: 'IPV-2 (polio injection)', protects: 'Polio', ageDays: 274, label: '9 months' },
  { code: 'mr2', name: 'Measles-Rubella (MR)-2', protects: 'Measles, rubella', ageDays: 456, label: '15 months' },
];

const DAY = 86400000;

// Children under 6 get the schedule; given vaccines are matched by code (or a close name)
const scheduleFor = (patient, today = new Date()) => {
  if (!patient.dateOfBirth) return { applicable: false, reason: 'no-dob', items: [] };
  const dob = new Date(patient.dateOfBirth);
  const ageDays = Math.floor((today - dob) / DAY);
  if (ageDays > 6 * 365) return { applicable: false, reason: 'adult', items: [] };
  const given = patient.vaccinations || [];
  const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const items = EPI_SCHEDULE.map((v) => {
    const match = given.find((g) => g.code === v.code || norm(g.name) === norm(v.name) || norm(g.name) === v.code);
    const dueDate = new Date(dob.getTime() + v.ageDays * DAY);
    const daysUntil = Math.floor((dueDate - today) / DAY);
    const status = match ? 'given' : daysUntil < -28 ? 'overdue' : daysUntil <= 7 ? 'due' : 'upcoming';
    return { ...v, dueDate: dueDate.toISOString().slice(0, 10), status, givenOn: match?.date || null };
  });
  return { applicable: true, ageDays, items };
};

module.exports = { EPI_SCHEDULE, scheduleFor };
