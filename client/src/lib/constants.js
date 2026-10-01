// Mirrors server/models/constants.js

export const RECORD_CATEGORIES = ['General', 'Diagnosis', 'Prescription', 'Lab result', 'Imaging', 'Vaccination', 'Allergy', 'Surgery', 'Follow-up'];

export const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

export const SPECIALIZATIONS = [
  'General Physician', 'Cardiology', 'Dermatology', 'Endocrinology', 'ENT', 'Gastroenterology', 'Gynaecology',
  'Nephrology', 'Neurology', 'Oncology', 'Ophthalmology', 'Orthopaedics', 'Paediatrics', 'Psychiatry',
  'Pulmonology', 'Radiology', 'Urology', 'Dentistry', 'Other',
];

export const VITAL_TYPES = {
  bloodPressure: { label: 'Blood pressure', short: 'BP', unit: 'mmHg', paired: true, placeholder: ['Systolic', 'Diastolic'] },
  glucose: { label: 'Blood glucose', short: 'Glucose', unit: 'mg/dL', placeholder: ['e.g. 105'] },
  heartRate: { label: 'Heart rate', short: 'Pulse', unit: 'bpm', placeholder: ['e.g. 72'] },
  weight: { label: 'Weight', short: 'Weight', unit: 'kg', placeholder: ['e.g. 70.5'] },
  temperature: { label: 'Temperature', short: 'Temp', unit: '°F', placeholder: ['e.g. 98.6'] },
  oxygen: { label: 'Oxygen saturation', short: 'SpO₂', unit: '%', placeholder: ['e.g. 98'] },
};

// General reference ranges for adults, used only to highlight readings worth discussing with a doctor
export const vitalFlag = (type, value, value2) => {
  switch (type) {
    case 'bloodPressure':
      if (value >= 140 || value2 >= 90) return 'high';
      if (value >= 130 || value2 >= 80) return 'elevated';
      if (value < 90 || value2 < 60) return 'low';
      return null;
    case 'glucose':
      return value >= 140 ? 'high' : value < 70 ? 'low' : null;
    case 'heartRate':
      return value > 100 ? 'high' : value < 50 ? 'low' : null;
    case 'temperature':
      return value >= 100.4 ? 'high' : value < 95 ? 'low' : null;
    case 'oxygen':
      return value < 95 ? 'low' : null;
    default:
      return null;
  }
};

export const formatVitalValue = (v) => (v.value2 != null ? `${v.value}/${v.value2}` : `${v.value}`);
