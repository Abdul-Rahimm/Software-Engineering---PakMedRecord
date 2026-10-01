// Shared enums used by models, validation and the AI tools

const RECORD_CATEGORIES = ['General', 'Diagnosis', 'Prescription', 'Lab result', 'Imaging', 'Vaccination', 'Allergy', 'Surgery', 'Follow-up'];

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

const SPECIALIZATIONS = [
  'General Physician', 'Cardiology', 'Dermatology', 'Endocrinology', 'ENT', 'Gastroenterology', 'Gynaecology',
  'Nephrology', 'Neurology', 'Oncology', 'Ophthalmology', 'Orthopaedics', 'Paediatrics', 'Psychiatry',
  'Pulmonology', 'Radiology', 'Urology', 'Dentistry', 'Other',
];

// Vital sign types: unit and whether a second value is recorded (diastolic for BP)
const VITAL_TYPES = {
  bloodPressure: { label: 'Blood pressure', unit: 'mmHg', paired: true },
  glucose: { label: 'Blood glucose', unit: 'mg/dL' },
  heartRate: { label: 'Heart rate', unit: 'bpm' },
  weight: { label: 'Weight', unit: 'kg' },
  temperature: { label: 'Temperature', unit: '°F' },
  oxygen: { label: 'Oxygen saturation', unit: '%' },
};

module.exports = { RECORD_CATEGORIES, BLOOD_GROUPS, SPECIALIZATIONS, VITAL_TYPES };
