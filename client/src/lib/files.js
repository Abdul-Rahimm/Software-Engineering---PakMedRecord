import api from '../api';
import { getSession } from '../session';

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:3009';

export const MAX_BYTES = 4 * 1024 * 1024;
export const ACCEPT = 'application/pdf,image/jpeg,image/png,image/webp';
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export const isSupported = (file) => file.type === 'application/pdf' || IMAGE_TYPES.includes(file.type);

export const formatBytes = (n) => (n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`);

// Large phone photos are scaled down (max 2200px, JPEG) so they upload fast and fit the 4 MB limit
const shrinkImage = async (file) => {
  if (!IMAGE_TYPES.includes(file.type)) return file;
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return file;
  const longSide = Math.max(bitmap.width, bitmap.height);
  if (file.size <= 2.5 * 1024 * 1024 && longSide <= 2600) return file;
  const scale = Math.min(1, 2200 / longSide);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85));
  if (!blob) return file;
  return new File([blob], file.name.replace(/\.(png|webp|jpe?g)$/i, '') + '.jpg', { type: 'image/jpeg' });
};

// Uploads one file for a patient; the server stores it and has the AI read it.
// onProgress(0..1) reports upload progress; resolves with the attachment (including OCR result).
export const uploadFile = async (file, patientCNIC, onProgress) => {
  const prepared = await shrinkImage(file);
  if (prepared.size > MAX_BYTES) throw new Error('This file is larger than 4 MB. Try a smaller scan or a photo.');
  const token = getSession()?.token;
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${BASE}/files/${patientCNIC}`);
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.setRequestHeader('Content-Type', prepared.type || 'application/octet-stream');
    xhr.setRequestHeader('X-File-Name', encodeURIComponent(file.name));
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress?.(e.loaded / e.total);
    xhr.upload.onload = () => onProgress?.(1);
    xhr.onload = () => {
      let data = {};
      try { data = JSON.parse(xhr.responseText); } catch { /* not JSON */ }
      if (xhr.status >= 200 && xhr.status < 300) resolve(data.attachment);
      else reject(new Error(data.error || `Upload failed (${xhr.status})`));
    };
    xhr.onerror = () => reject(new Error('Upload failed. Check your connection.'));
    xhr.send(prepared);
  });
};

export const retryReading = async (id) => (await api.post(`/files/${id}/ocr`)).data.attachment;

export const deleteUpload = (id) => api.delete(`/files/${id}`);

// Files are private: fetch with the session token and show them through a local object URL
export const fetchFileUrl = async (id) => {
  const res = await api.get(`/files/${id}/content`, { responseType: 'blob' });
  return URL.createObjectURL(res.data);
};

export const downloadFile = async (attachment) => {
  const url = await fetchFileUrl(attachment._id);
  const a = document.createElement('a');
  a.href = url;
  a.download = attachment.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
};
