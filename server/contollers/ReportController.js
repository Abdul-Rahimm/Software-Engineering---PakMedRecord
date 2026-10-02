const expressAsyncHandler = require('express-async-handler');
const Report = require('../models/ReportModel');
const Doctor = require('../models/DoctorModel');
const Patient = require('../models/PatientModel');

// POST /reports { targetRole, targetCNIC, reason, details }
const create = expressAsyncHandler(async (req, res) => {
  const { targetRole, targetCNIC, reason, details } = req.body || {};
  if (!['doctor', 'patient'].includes(targetRole)) return res.status(400).json({ error: 'Unknown account type' });
  if (!['fake-doctor', 'inappropriate', 'privacy', 'spam', 'other'].includes(reason)) return res.status(400).json({ error: 'Choose a reason' });
  const exists = targetRole === 'doctor' ? await Doctor.exists({ doctorCNIC: Number(targetCNIC) }) : await Patient.exists({ patientCNIC: Number(targetCNIC) });
  if (!exists) return res.status(404).json({ error: 'Account not found' });
  const recent = await Report.countDocuments({ 'reporter.role': req.user.role, 'reporter.cnic': req.user.cnic, createdAt: { $gte: new Date(Date.now() - 86400000) } });
  if (recent >= 5) return res.status(429).json({ error: 'You have sent several reports today. Our team will review them.' });
  await Report.create({
    reporter: { role: req.user.role, cnic: req.user.cnic },
    target: { role: targetRole, cnic: Number(targetCNIC) },
    reason,
    details: String(details || '').trim().slice(0, 1000),
  });
  res.status(201).json({ message: 'Thanks. Our team will review this report.' });
});

module.exports = { create };
