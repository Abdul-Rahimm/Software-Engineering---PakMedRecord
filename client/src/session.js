// Signed-in user, stored as { token, role: 'doctor' | 'patient', cnic }
const KEY = 'pakmedrecord.session';

export const getSession = () => {
  try {
    return JSON.parse(localStorage.getItem(KEY));
  } catch {
    return null;
  }
};

export const saveSession = (session) => {
  localStorage.setItem(KEY, JSON.stringify(session));
};

export const clearSession = () => {
  localStorage.removeItem(KEY);
};
