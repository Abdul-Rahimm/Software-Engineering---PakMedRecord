// Hospital/clinic staff sign-in (email + password, two-step if turned on).
// Everything else about organizations lives in OrgController.

const bcrypt = require('bcrypt');
const expressAsyncHandler = require('express-async-handler');
const Staff = require('../models/StaffModel');
const { completeSignIn } = require('../lib/session');

const staffSignin = expressAsyncHandler(async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const staff = await Staff.findOne({ email });
  if (!staff || !(await bcrypt.compare(String(req.body?.password || ''), staff.password))) return res.status(401).json({ error: 'Invalid credentials' });
  const { status, body } = completeSignIn('staff', staff, 'Signed in');
  res.status(status).json(body);
});

module.exports = { staffSignin };
