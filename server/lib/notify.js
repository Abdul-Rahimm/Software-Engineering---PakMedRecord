const Notification = require('../models/NotificationModel');

// Fire-and-forget: a failed notification must never fail the request that caused it
const notify = (role, cnic, { type, title, body, link }) =>
  Notification.create({ role, cnic: Number(cnic), type, title, body, link }).catch((err) =>
    console.error('Failed to create notification:', err.message)
  );

module.exports = { notify };
