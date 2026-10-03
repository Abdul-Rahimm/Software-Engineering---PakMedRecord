// Safepay (getsafepay.com) hosted checkout, following Safepay's current SDK (sfpy-php / v3 API):
//   1. POST {api}/order/payments/v3/            -> tracker   (X-SFPY-MERCHANT-SECRET, amount in paisa)
//   2. POST {api}/client/passport/v1/token       -> time-based token ("tbt") for the checkout page
//   3. send the customer to {checkout}/embedded?environment&tracker&tbt&source=hosted&order_id&redirect_url&cancel_url
//   4. confirm with GET {api}/reporter/api/v1/payments/{tracker} (state TRACKER_ENDED = paid);
//      webhooks are signed HMAC-SHA512(webhook secret, body) in X-SFPY-SIGNATURE
// SAFEPAY_BASE_URL overrides every host (used for local tests against a stand-in server).

const crypto = require('crypto');

const API = { sandbox: 'https://sandbox.api.getsafepay.com', production: 'https://api.getsafepay.com' };
const CHECKOUT = { sandbox: 'https://sandbox.api.getsafepay.com', production: 'https://getsafepay.com' };
const apiBase = (environment) => (process.env.SAFEPAY_BASE_URL || API[environment] || API.sandbox).replace(/\/$/, '');
const checkoutBase = (environment) => (process.env.SAFEPAY_BASE_URL || CHECKOUT[environment] || CHECKOUT.sandbox).replace(/\/$/, '');

const call = async (environment, secretKey, method, path, body, ms = 15000) => {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), ms);
  try {
    const res = await fetch(`${apiBase(environment)}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', 'X-SFPY-MERCHANT-SECRET': secretKey },
      body: body ? JSON.stringify(body) : undefined,
      signal: ac.signal,
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      const reason = [].concat(json?.status?.errors || [], json?.message || [], json?.error || []).filter(Boolean).join(', ') || `HTTP ${res.status}`;
      throw Object.assign(new Error(reason), { status: res.status });
    }
    return json?.data;
  } finally {
    clearTimeout(t);
  }
};

// Opens an order for `amount` rupees; returns the tracker token
const createTracker = async ({ environment, publicKey }, secretKey, amount) => {
  const data = await call(environment, secretKey, 'POST', '/order/payments/v3/', {
    merchant_api_key: publicKey, intent: 'CYBERSOURCE', mode: 'payment', currency: 'PKR', amount: Math.round(Number(amount) * 100),
  });
  const token = data?.tracker?.token;
  if (!token) throw Object.assign(new Error('Safepay did not return an order'), { status: 502 });
  return token;
};

const passportToken = async ({ environment }, secretKey) => {
  const data = await call(environment, secretKey, 'POST', '/client/passport/v1/token');
  const token = typeof data === 'string' ? data : data?.token;
  if (!token) throw Object.assign(new Error('Safepay did not return a checkout token'), { status: 502 });
  return token;
};

// source=hosted makes Safepay send the customer back to redirect_url?order_id=…&tracker=… when paid
const checkoutUrl = ({ environment }, { tracker, tbt, orderId, redirectUrl, cancelUrl }) => {
  const qs = new URLSearchParams({ environment, tracker, source: 'hosted', tbt, order_id: orderId, redirect_url: redirectUrl, cancel_url: cancelUrl });
  return `${checkoutBase(environment)}/embedded?${qs}`;
};

const lookupPayment = ({ environment }, secretKey, tracker) =>
  call(environment, secretKey, 'GET', `/reporter/api/v1/payments/${encodeURIComponent(tracker)}`);

const safeEqual = (a, b) => {
  const x = Buffer.from(String(a || ''));
  const y = Buffer.from(String(b || ''));
  return x.length === y.length && x.length > 0 && crypto.timingSafeEqual(x, y);
};

// Webhook: Safepay signs the JSON body. Check the raw bytes and the re-serialised body.
const verifyWebhook = (webhookSecret, rawBody, parsedBody, signature) => {
  if (!webhookSecret || !signature) return false;
  const h = (data) => crypto.createHmac('sha512', webhookSecret).update(data).digest('hex');
  return safeEqual(h(rawBody), signature) || safeEqual(h(JSON.stringify(parsedBody)), signature);
};

// Does a status / webhook body say the payment completed?
const isPaidState = (body) => {
  // status lookup: the order's own state is authoritative
  const state = body?.data?.state ?? body?.state;
  if (typeof state === 'string' && /^TRACKER_/.test(state)) return state === 'TRACKER_ENDED';
  const text = JSON.stringify(body?.data ?? body ?? {}).toUpperCase();
  return /"(STATE|STATUS)":"(PAID|TRACKER_ENDED|CAPTURED|COMPLETED|SUCCESS)"/.test(text) || /PAYMENT[:._]?(SUCCEEDED|COMPLETED|CAPTURED)/.test(text);
};

module.exports = { createTracker, passportToken, checkoutUrl, lookupPayment, verifyWebhook, isPaidState };
