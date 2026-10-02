// Outbound messages to patients: in-app notification always, plus email, WhatsApp and SMS
// according to the patient's preferences and what the server has configured.
//   WhatsApp: Meta WhatsApp Cloud API (WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID, optional WHATSAPP_TEMPLATE)
//   SMS: Twilio (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM)

const { notify } = require('./notify');
const { mailEnabled, sendMail, brandedEmail } = require('./mailer');

const whatsappEnabled = () => Boolean(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID);
const smsEnabled = () => Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM);

// "0300-1234567" / "3001234567" / "+92 300 1234567" -> "+923001234567"
const toE164 = (phone) => {
  let d = String(phone || '').replace(/[^\d+]/g, '');
  if (d.startsWith('+')) return /^\+\d{10,15}$/.test(d) ? d : null;
  if (d.startsWith('0092')) d = d.slice(2);
  if (d.startsWith('92') && d.length === 12) return `+${d}`;
  if (d.startsWith('03') && d.length === 11) return `+92${d.slice(1)}`;
  if (d.startsWith('3') && d.length === 10) return `+92${d}`;
  return null;
};

const sendWhatsApp = async (phone, text) => {
  const to = toE164(phone);
  if (!to) throw new Error('No valid phone number');
  const template = process.env.WHATSAPP_TEMPLATE;
  // Business-initiated messages must use an approved template; its single body parameter carries the text
  const message = template
    ? { type: 'template', template: { name: template, language: { code: process.env.WHATSAPP_TEMPLATE_LANG || 'en' }, components: [{ type: 'body', parameters: [{ type: 'text', text: text.slice(0, 1000) }] }] } }
    : { type: 'text', text: { body: text.slice(0, 4000) } };
  const res = await fetch(`https://graph.facebook.com/v21.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', to: to.slice(1), ...message }),
  });
  if (!res.ok) throw new Error(`WhatsApp ${res.status}: ${(await res.text()).slice(0, 200)}`);
};

const sendSms = async (phone, text) => {
  const to = toE164(phone);
  if (!to) throw new Error('No valid phone number');
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${sid}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ To: to, From: process.env.TWILIO_FROM, Body: text.slice(0, 600) }),
  });
  if (!res.ok) throw new Error(`SMS ${res.status}: ${(await res.text()).slice(0, 200)}`);
};

const channels = () => ({ email: mailEnabled(), whatsapp: whatsappEnabled(), sms: smsEnabled() });

// Reaches a patient on every channel they opted into. Dependents are reached through their guardian.
// Returns the list of channels that worked.
const deliver = async (patient, { type, title, body, link }, guardian) => {
  const contact = guardian || patient;
  const prefs = contact.notificationPrefs || {};
  const sent = ['in-app'];
  notify('patient', patient.patientCNIC, { type, title, body, link });
  if (guardian) notify('patient', guardian.patientCNIC, { type, title: `${patient.firstName}: ${title}`, body, link: null });
  const text = `PakMedRecord: ${guardian ? `(${patient.firstName}) ` : ''}${title}. ${body}`;
  const app = (process.env.APP_URL || '').replace(/\/$/, '');
  const jobs = [];
  if (prefs.email !== false && mailEnabled() && contact.email) {
    jobs.push(sendMail({ to: contact.email, ...brandedEmail({ subject: title, name: contact.firstName, paragraphs: [guardian ? `For ${patient.firstName} ${patient.lastName}:` : '', body], button: app && link ? { label: 'Open PakMedRecord', link: `${app}${link}` } : undefined }) }).then(() => sent.push('email')));
  }
  if (prefs.whatsapp && whatsappEnabled() && contact.phone) jobs.push(sendWhatsApp(contact.phone, text).then(() => sent.push('whatsapp')));
  if (prefs.sms && smsEnabled() && contact.phone) jobs.push(sendSms(contact.phone, text).then(() => sent.push('sms')));
  const results = await Promise.allSettled(jobs);
  results.filter((r) => r.status === 'rejected').forEach((r) => console.error('Reminder delivery failed:', r.reason?.message));
  return sent;
};

module.exports = { channels, deliver, toE164, sendWhatsApp, sendSms, whatsappEnabled, smsEnabled };
