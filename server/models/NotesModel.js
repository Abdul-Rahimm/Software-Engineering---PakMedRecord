const mongoose = require('mongoose');

const noteSchema = new mongoose.Schema({
  patientCNIC: {
    type: Number,
    required: true,
  },
  note: {
    type: String,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const Note = mongoose.model('Note', noteSchema);

module.exports = Note;
