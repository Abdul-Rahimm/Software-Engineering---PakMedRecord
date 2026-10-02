// Sends email through the Gmail API (Google Cloud) as the configured Gmail account.
// Needs GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN and GMAIL_SENDER.

const { OAuth2Client } = require('google-auth-library');

const SEND_URL = 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send';

const mailEnabled = () =>
  Boolean(process.env.GMAIL_CLIENT_ID && process.env.GMAIL_CLIENT_SECRET && process.env.GMAIL_REFRESH_TOKEN && process.env.GMAIL_SENDER);

let oauth;
const client = () => {
  if (!oauth) {
    oauth = new OAuth2Client(process.env.GMAIL_CLIENT_ID, process.env.GMAIL_CLIENT_SECRET);
    oauth.setCredentials({ refresh_token: process.env.GMAIL_REFRESH_TOKEN });
  }
  return oauth;
};

// RFC 2047 encoding so non-ASCII subjects survive
const encodeHeader = (text) => (/^[\x20-\x7e]*$/.test(text) ? text : `=?UTF-8?B?${Buffer.from(text).toString('base64')}?=`);

// Build a multipart/alternative MIME message and base64url-encode it for the API
const buildRaw = ({ to, subject, text, html }) => {
  const boundary = `pmr_${Date.now().toString(36)}`;
  const mime = [
    `From: PakMedRecord <${process.env.GMAIL_SENDER}>`,
    `To: ${to}`,
    `Subject: ${encodeHeader(subject)}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: base64',
    '',
    Buffer.from(text).toString('base64'),
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    'Content-Transfer-Encoding: base64',
    '',
    Buffer.from(html).toString('base64'),
    `--${boundary}--`,
  ].join('\r\n');
  return Buffer.from(mime).toString('base64url');
};

const sendMail = async (message) => {
  const { token } = await client().getAccessToken();
  const res = await fetch(SEND_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ raw: buildRaw(message) }),
  });
  if (!res.ok) {
    throw new Error(`Gmail API ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
  return res.json();
};

const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const verificationEmail = ({ name, link }) => ({
  subject: 'Verify your PakMedRecord email',
  text: `Hi ${name},\n\nWelcome to PakMedRecord. Confirm your email address by opening this link (valid for 24 hours):\n\n${link}\n\nIf you didn't create this account, you can ignore this email.\n\n— PakMedRecord`,
  html: `<!doctype html><html><body style="margin:0;background:#f3f6fb;font-family:Arial,Helvetica,sans-serif;color:#0f172a">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 12px"><tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:16px;border:1px solid #e2e8f0">
      <tr><td style="padding:28px 32px 8px;font-size:20px;font-weight:bold">PakMed<span style="color:#059669">Record</span></td></tr>
      <tr><td style="padding:8px 32px;font-size:15px;line-height:1.6">
        <p style="margin:0 0 12px">Hi ${escapeHtml(name)},</p>
        <p style="margin:0 0 20px">Welcome to PakMedRecord. Please confirm your email address to activate your account.</p>
        <p style="margin:0 0 24px"><a href="${link}" style="display:inline-block;background:#059669;color:#ffffff;text-decoration:none;font-weight:bold;padding:12px 22px;border-radius:10px">Verify my email</a></p>
        <p style="margin:0 0 8px;font-size:13px;color:#64748b">Or paste this link into your browser (valid for 24 hours):</p>
        <p style="margin:0 0 20px;font-size:12px;word-break:break-all;color:#475569">${link}</p>
        <p style="margin:0;font-size:13px;color:#64748b">If you didn't create this account, you can ignore this email.</p>
      </td></tr>
      <tr><td style="padding:20px 32px 28px;font-size:12px;color:#94a3b8">PakMedRecord · One medical record, every hospital.</td></tr>
    </table>
  </td></tr></table></body></html>`,
});

module.exports = { mailEnabled, sendMail, verificationEmail };
