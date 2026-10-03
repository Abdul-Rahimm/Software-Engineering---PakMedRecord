// Encrypts merchant secrets (e.g. Safepay secret keys) before they are stored, with AES-256-GCM.
// Key: PAYMENT_SECRETS_KEY (64 hex chars). Without it a key is derived from JWT_SECRET so local
// development works; set a dedicated key in production so the two can be rotated separately.

const crypto = require('crypto');
const { jwt_secret } = require('../config');

let cached;
const key = () => {
  if (cached) return cached;
  const hex = process.env.PAYMENT_SECRETS_KEY;
  if (hex && /^[0-9a-f]{64}$/i.test(hex)) cached = Buffer.from(hex, 'hex');
  else {
    if (process.env.NODE_ENV === 'production' || process.env.VERCEL) console.warn('PAYMENT_SECRETS_KEY is not set; deriving the payment secrets key from JWT_SECRET.');
    cached = crypto.createHash('sha256').update(`pakmed-payments:${jwt_secret}`).digest();
  }
  return cached;
};

// -> "v1.<iv>.<tag>.<ciphertext>" (base64url)
const encrypt = (plain) => {
  if (!plain) return undefined;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const data = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  return ['v1', iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), data.toString('base64url')].join('.');
};

const decrypt = (blob) => {
  if (!blob) return '';
  const [v, iv, tag, data] = String(blob).split('.');
  if (v !== 'v1') throw new Error('Unknown secret format');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key(), Buffer.from(iv, 'base64url'));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(data, 'base64url')), decipher.final()]).toString('utf8');
};

// "sec_abc…xyz" for showing which key is saved without revealing it
const mask = (s) => (s ? `${s.slice(0, 6)}…${s.slice(-4)}` : '');

module.exports = { encrypt, decrypt, mask };
