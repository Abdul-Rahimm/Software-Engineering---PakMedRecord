const mongoose = require('mongoose');

// WebRTC signalling messages for a video visit (offer/answer/ICE), removed after an hour
const callSignalSchema = new mongoose.Schema({
  appointmentId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  from: { type: String, enum: ['doctor', 'patient'], required: true },
  kind: { type: String, enum: ['hello', 'offer', 'answer', 'ice', 'bye'], required: true },
  data: mongoose.Schema.Types.Mixed,
  createdAt: { type: Date, default: Date.now, expires: 3600 },
});

module.exports = mongoose.model('CallSignal', callSignalSchema);
