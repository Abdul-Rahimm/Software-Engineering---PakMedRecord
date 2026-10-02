const mongoose = require('mongoose');
const { RECORD_CATEGORIES } = require('./constants');

// An uploaded medical document (PDF or image). The bytes live in GridFS bucket "recordfiles";
// this holds who it belongs to and the text the AI extracted from it.
const attachmentSchema = new mongoose.Schema({
  gridId: { type: mongoose.Schema.Types.ObjectId, required: true },
  patientCNIC: { type: Number, required: true, index: true },
  uploadedBy: {
    role: { type: String, enum: ['doctor', 'patient'], required: true },
    cnic: { type: Number, required: true },
  },
  name: { type: String, required: true, maxlength: 200 },
  mime: { type: String, required: true },
  size: { type: Number, required: true },
  // set once the file is part of a submitted or saved record
  linked: { type: Boolean, default: false },
  ocr: {
    status: { type: String, enum: ['pending', 'done', 'failed'], default: 'pending' },
    text: { type: String, default: '' },
    title: { type: String, default: '' },
    category: { type: String, enum: [...RECORD_CATEGORIES, ''], default: '' },
    documentDate: { type: String, default: '' },
    summary: { type: String, default: '' },
    error: { type: String, default: '' },
  },
}, { timestamps: true });

module.exports = mongoose.model('Attachment', attachmentSchema);
