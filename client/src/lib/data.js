import { useCallback, useEffect, useState } from 'react';
import api from '../api';

// Small fetch hook: { data, loading, error, reload, setData }
export const useFetch = (loader, deps) => {
  const [state, setState] = useState({ data: null, loading: true, error: null });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(loader, deps);

  // silent: refresh in the background without showing loading skeletons
  const reload = useCallback(async (silent = false) => {
    if (!silent) setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await run();
      setState({ data, loading: false, error: null });
    } catch (error) {
      if (!silent) setState({ data: null, loading: false, error });
    }
  }, [run]);

  useEffect(() => { reload(); }, [reload]);

  // the AI assistant can book appointments / log vitals / save notes: refresh open pages
  useEffect(() => {
    const onChange = () => reload(true);
    window.addEventListener('pakmed:data-changed', onChange);
    return () => window.removeEventListener('pakmed:data-changed', onChange);
  }, [reload]);

  const setData = useCallback((updater) => {
    setState((s) => ({ ...s, data: typeof updater === 'function' ? updater(s.data) : updater }));
  }, []);

  return { ...state, reload, setData };
};

// Doctors the patient is affiliated with, with their profiles
export const fetchCareTeam = async (patientCNIC) => {
  const { data } = await api.get(`/affiliation/getmydoctors/${patientCNIC}`);
  const cnics = [...new Set(data.flatMap((a) => a.doctorCNIC))];
  const doctors = await Promise.all(cnics.map((c) => api.get(`/doctor/home/${c}`).then((r) => r.data).catch(() => null)));
  return doctors.filter(Boolean);
};

// Patients affiliated with the doctor, with their profiles
export const fetchPatients = async (doctorCNIC) => {
  const { data } = await api.get(`/affiliation/getmypatients/${doctorCNIC}`);
  const cnics = [...new Set(data.map((a) => a.patientCNIC))];
  const patients = await Promise.all(cnics.map((c) => api.get(`/patient/home/${c}`).then((r) => r.data).catch(() => null)));
  return patients.filter(Boolean);
};

export const fetchAllDoctors = async () => (await api.get('/doctor/doctors')).data;

export const indexBy = (list, key) => Object.fromEntries((list || []).map((x) => [x[key], x]));

export const byNewest = (a, b) => new Date(b.createdAt || b.date || 0) - new Date(a.createdAt || a.date || 0);

// What the server has configured (payments, reminder channels…), fetched once per page load
let optionsPromise;
export const fetchServerOptions = () => {
  optionsPromise ||= api.get('/auth/options').then((r) => r.data).catch(() => {
    optionsPromise = undefined;
    return { payments: [], channels: {} };
  });
  return optionsPromise;
};
export const useServerOptions = () => {
  const [options, setOptions] = useState(null);
  useEffect(() => { fetchServerOptions().then(setOptions); }, []);
  return options;
};
