const mongoose = require('mongoose');

const affiliationSchema = new mongoose.Schema({
  patientCNIC: {
    type: Number,
    required: true,
  },
  doctorCNIC: [{
    type: Number,
    required: true,
  }]
});

const Affiliation = mongoose.model('Affiliation', affiliationSchema);

module.exports = Affiliation;
