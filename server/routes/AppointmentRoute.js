const express = require('express');
const router = express.Router();
const { book, getAppointments } = require('../contollers/AppointmentController');

// Routes
router.route('/book').post(book);
// Define route for fetching appointments by doctorCNIC
router.get('/fetch/:doctorCNIC', getAppointments);



module.exports = router;
