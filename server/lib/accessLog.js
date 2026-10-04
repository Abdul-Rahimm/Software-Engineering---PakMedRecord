// Records who looked at a patient's information, shown to the patient as "Who viewed my record".

const AccessLog = require('../models/AccessLogModel');

const WINDOW_MS = 10 * 60 * 1000;

// Fire-and-forget; repeated views in the same 10 minutes are counted on one row
const logAccess = (patientCNIC, actor, action, ip) => {
  const bucket = `${patientCNIC}:${actor.role}:${actor.cnic || actor.id || ''}:${action}:${Math.floor(Date.now() / WINDOW_MS)}`;
  return AccessLog.updateOne(
    { bucket },
    { $setOnInsert: { patientCNIC: Number(patientCNIC), actor, action, ip, ...(actor.orgId && { orgId: actor.orgId }) }, $inc: { count: 1 }, $set: { lastAt: new Date() } },
    { upsert: true }
  ).catch((err) => console.error('Failed to log access:', err.message));
};

// What a doctor's request touched, from the API area it hit
const ACTIONS = {
  '/patient': 'Viewed your profile',
  '/record': 'Viewed your records',
  '/files': 'Opened a document',
  '/vitals': 'Viewed your vitals',
  '/ai': 'Generated an AI brief',
  '/prescriptions': 'Viewed prescriptions',
  '/labs': 'Viewed lab trends',
  '/meds': 'Viewed medicine adherence',
  '/vaccines': 'Viewed vaccinations',
  '/followups': 'Checked your follow-ups',
};
const actionFor = (req) => {
  const base = ACTIONS[req.baseUrl] || 'Accessed your information';
  return req.method === 'GET' ? base : base.replace(/^Viewed/, 'Updated');
};

module.exports = { logAccess, actionFor };
