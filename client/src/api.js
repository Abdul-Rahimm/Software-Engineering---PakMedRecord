import axios from 'axios';
import { getSession, clearSession } from './session';

// Shared axios instance: points at the backend and sends the signed-in user's token
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3009',
});

api.interceptors.request.use((config) => {
  const session = getSession();
  if (session) {
    config.headers.Authorization = `Bearer ${session.token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Expired or missing token: drop the session and go back to the landing page
    if (error.response?.status === 401 && getSession()) {
      clearSession();
      window.location.assign('/');
    }
    return Promise.reject(error);
  }
);

export default api;
