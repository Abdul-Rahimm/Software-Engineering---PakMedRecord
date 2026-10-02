import api from '../api';
import { getSession, saveSession } from '../session';

// Switch the whole app to a family member's profile (or back to the guardian's own)
export const switchProfile = async (cnic) => {
  const { data } = await api.post(`/family/${cnic}/switch`);
  const current = getSession();
  saveSession({
    token: data.token,
    role: 'patient',
    cnic: data.patient.patientCNIC,
    ...(data.guardian && { guardian: data.guardian, guardianName: current?.guardianName || current?.name, name: `${data.patient.firstName} ${data.patient.lastName}` }),
  });
  window.location.assign(`/patient/home/${data.patient.patientCNIC}`);
};
