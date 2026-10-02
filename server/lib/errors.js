// Last-resort error handling: log to the console and the ErrorLog collection (visible to admins)

const ErrorLog = require('../models/ErrorLogModel');

const recordError = (err, req) =>
  ErrorLog.create({
    message: String(err?.message || err).slice(0, 1000),
    stack: String(err?.stack || '').slice(0, 4000),
    method: req?.method,
    path: req?.originalUrl?.split('?')[0],
    user: req?.user ? `${req.user.role}:${req.user.cnic ?? req.user.id}` : undefined,
  }).catch(() => {});

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  if (err.type === 'entity.too.large') return res.status(413).json({ error: 'Request is too large' });
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON' });
  console.error(`${req.method} ${req.originalUrl} failed:`, err);
  recordError(err, req);
  if (res.headersSent) return res.end();
  res.status(err.status && err.status < 500 ? err.status : 500).json({ error: err.status && err.status < 500 ? err.message : 'Internal server error' });
};

module.exports = { errorHandler, recordError };
