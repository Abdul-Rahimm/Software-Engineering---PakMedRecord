// Safepay (getsafepay.com) hosted checkout, following the flow of Safepay's Node SDK:
//   1. POST {base}/order/v1/init with the merchant's public key -> a "tracker" token
//   2. send the customer to {base}/components?beacon=<tracker>&... (cards, JazzCash, Easypaisa, bank)
//   3. Safepay sends the browser back to our redirect URL with tracker + sig, where
//      sig = HMAC-SHA256(secret key, tracker); webhooks are signed HMAC-SHA512(webhook secret, body)
// SAFEPAY_BASE_URL overrides both environments (used for local testing against a stand-in server).

const crypto = require('crypto');

const BASES = { sandbox: 'https://sandbox.api.getsafepay.com', production: 'https://api.getsafepay.com' };
const baseUrl = (environment) => (process.env.SAFEPAY_BASE_URL || BASES[environment] || BASES.sandbox).replace(/\/$/, '');

const timedFetch = async (url, options = {}, ms = 15000) => {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), ms);
  try {
    return await fetch(url, { ...options, signal: ac.signal });
  } finally {
    clearTimeout(t);
  }
};

// Creates an order for `amount` rupees; returns the tracker token
const createTracker = async ({ environment, publicKey }, amount) => {
  const res = await timedFetch(`${baseUrl(environment)}/order/v1/init`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client: publicKey, amount: Number(amount), currency: 'PKR', environment }),
  });
  const body = await res.json().catch(() => ({}));
  const token = body?.data?.token;
  if (!res.ok || !token) {
    const reason = body?.status?.errors?.join?.(', ') || body?.message || `HTTP ${res.status}`;
    throw Object.assign(new Error(`Safepay rejected the order: ${reason}`), { status: 502 });
  }
  return token;
};

const checkoutUrl = ({ environment }, { tracker, orderId, redirectUrl, cancelUrl }) => {
  const qs = new URLSearchParams({
    env: environment, beacon: tracker, source: 'custom', order_id: orderId,
    redirect_url: redirectUrl, cancel_url: cancelUrl, webhooks: 'true',
  });
  return `${baseUrl(environment)}/components?${qs}`;
};

const safeEqual = (a, b) => {
  const x = Buffer.from(String(a || ''));
  const y = Buffer.from(String(b || ''));
  return x.length === y.length && x.length > 0 && crypto.timingSafeEqual(x, y);
};

// Redirect back from checkout
const verifyRedirect = (secretKey, tracker, sig) =>
  safeEqual(crypto.createHmac('sha256', secretKey).update(String(tracker || '')).digest('hex'), sig);

// Webhook: Safepay signs the JSON body. Check the raw bytes and the re-serialised body (as the SDK does).
const verifyWebhook = (webhookSecret, rawBody, parsedBody, signature) => {
  if (!webhookSecret || !signature) return false;
  const h = (data) => crypto.createHmac('sha512', webhookSecret).update(data).digest('hex');
  return safeEqual(h(rawBody), signature) || safeEqual(h(JSON.stringify(parsedBody)), signature);
};

// Best-effort status lookup for payments whose redirect never came back (browser closed)
const lookupPayment = async ({ environment }, secretKey, tracker) => {
  const res = await timedFetch(`${baseUrl(environment)}/reporter/api/v1/payments/${encodeURIComponent(tracker)}`, {
    headers: { 'X-SFPY-MERCHANT-SECRET': secretKey },
  });
  if (!res.ok) throw new Error(`Safepay status lookup failed (HTTP ${res.status})`);
  return res.json();
};

// Does a webhook/status body say the payment completed?
const isPaidState = (body) => {
  const text = JSON.stringify(body?.data ?? body ?? {}).toUpperCase();
  return /"(STATE|STATUS)":"(PAID|TRACKER_ENDED|CAPTURED|COMPLETED|SUCCESS)"/.test(text) || /PAYMENT[:._]?(SUCCEEDED|COMPLETED|CAPTURED)/.test(text);
};

module.exports = { baseUrl, createTracker, checkoutUrl, verifyRedirect, verifyWebhook, lookupPayment, isPaidState };
