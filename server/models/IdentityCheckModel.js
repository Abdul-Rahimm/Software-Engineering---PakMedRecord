const mongoose = require('mongoose');

// A CNIC + live-face identity check. Photos are stored in GridFS. The face match, liveness and OCR
// scores are computed on the user's device, so they only guide the admin who reviews the photos:
// a tampered browser could fake them, which is why nothing is marked verified without a review.
const identityCheckSchema = new mongoose.Schema({
  purpose: { type: String, enum: ['account', 'claim'], required: true },
  role: { type: String, enum: ['doctor', 'patient', 'staff'], required: true },
  subject: String, // CNIC (doctor/patient) or staff id of the signed-in account; for claims, the disputed account's CNIC
  cnic: { type: Number, required: true }, // the CNIC on the card
  name: { type: String, trim: true, maxlength: 120 },
  // claims: how to reach the person who says the CNIC is theirs
  contact: { email: { type: String, trim: true, lowercase: true }, phone: String, message: { type: String, maxlength: 1000 } },
  files: {
    cnicFront: mongoose.Schema.Types.ObjectId,
    cnicBack: mongoose.Schema.Types.ObjectId,
    selfie: mongoose.Schema.Types.ObjectId,
    frames: [mongoose.Schema.Types.ObjectId],
  },
  device: {
    faceMatch: Number, // 0-1 similarity of the CNIC photo and the live face
    liveness: Number, // 0-1, model score
    realness: Number, // 0-1, anti-spoof (printed photo / screen) score
    challenges: [String], // challenges completed, in order
    ocrCnic: String, // number read from the card
    ocrMatches: Boolean,
    userAgent: String,
  },
  status: { type: String, enum: ['pending', 'verified', 'rejected'], default: 'pending' },
  note: { type: String, maxlength: 500 },
  outcome: { type: String, enum: ['', 'handed_over', 'frozen'], default: '' },
  reviewedAt: Date,
  ip: String,
}, { timestamps: true });

identityCheckSchema.index({ status: 1, createdAt: -1 });
identityCheckSchema.index({ cnic: 1 });

module.exports = mongoose.model('IdentityCheck', identityCheckSchema);
