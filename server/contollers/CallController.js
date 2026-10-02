// Video visits: peer-to-peer WebRTC between doctor and patient. The server only relays the
// connection set-up messages (offer / answer / network candidates); audio and video never pass through it.
// TURN_URL / TURN_USERNAME / TURN_CREDENTIAL add a relay for networks that block direct connections.

const mongoose = require('mongoose');
const expressAsyncHandler = require('express-async-handler');
const Appointment = require('../models/AppointmentModel');
const CallSignal = require('../models/CallSignalModel');
const Doctor = require('../models/DoctorModel');
const Patient = require('../models/PatientModel');

const loadCall = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.appointmentId)) {
    res.status(404).json({ error: 'Visit not found' });
    return null;
  }
  const a = await Appointment.findById(req.params.appointmentId);
  const { role, cnic } = req.user;
  const mine = a && ((role === 'doctor' && a.doctorCNIC === cnic) || (role === 'patient' && a.patientCNIC === cnic));
  if (!mine || a.mode !== 'video') {
    res.status(404).json({ error: 'Visit not found' });
    return null;
  }
  return a;
};

const iceServers = () => {
  const servers = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }];
  if (process.env.TURN_URL) {
    servers.push({ urls: process.env.TURN_URL.split(','), username: process.env.TURN_USERNAME, credential: process.env.TURN_CREDENTIAL });
  }
  return servers;
};

// GET /calls/:appointmentId -> who's on the call and how to connect
const info = expressAsyncHandler(async (req, res) => {
  const a = await loadCall(req, res);
  if (!a) return;
  const [doctor, patient] = await Promise.all([
    Doctor.findOne({ doctorCNIC: a.doctorCNIC }).select('firstName lastName specialization hospital').lean(),
    Patient.findOne({ patientCNIC: a.patientCNIC }).select('patientCNIC firstName lastName gender dateOfBirth').lean(),
  ]);
  res.status(200).json({
    appointment: a,
    doctor,
    patient,
    iceServers: iceServers(),
    fallbackUrl: `https://meet.jit.si/PakMedRecord-${a.roomId}`,
  });
});

// POST /calls/:appointmentId/signal { kind, data }
const send = expressAsyncHandler(async (req, res) => {
  const a = await loadCall(req, res);
  if (!a) return;
  const { kind, data } = req.body || {};
  if (!['hello', 'offer', 'answer', 'ice', 'bye'].includes(kind)) return res.status(400).json({ error: 'Unknown signal' });
  if (JSON.stringify(data ?? null).length > 20000) return res.status(413).json({ error: 'Signal too large' });
  const sig = await CallSignal.create({ appointmentId: a._id, from: req.user.role, kind, data });
  res.status(201).json({ id: sig._id });
});

// GET /calls/:appointmentId/signal?after=<id> -> the other side's messages since `after`
const poll = expressAsyncHandler(async (req, res) => {
  const a = await loadCall(req, res);
  if (!a) return;
  const filter = { appointmentId: a._id, from: req.user.role === 'doctor' ? 'patient' : 'doctor' };
  if (req.query.after && mongoose.isValidObjectId(req.query.after)) filter._id = { $gt: req.query.after };
  else filter.createdAt = { $gt: new Date(Date.now() - 60 * 1000) }; // first poll: only recent messages
  const messages = await CallSignal.find(filter).sort({ _id: 1 }).limit(100).lean();
  res.status(200).json({ messages: messages.map((m) => ({ id: m._id, kind: m.kind, data: m.data })) });
});

module.exports = { info, send, poll };
