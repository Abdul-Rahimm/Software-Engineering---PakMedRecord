const express = require('express');
const router = express.Router();
const { book, getAppointments, completeAppointment } = require('../contollers/AppointmentController');

// Routes
router.route('/book/:patientCNIC').post(book);
router.get('/fetch/:doctorCNIC', getAppointments);
router.patch('/update/:appointmentId', completeAppointment);


module.exports = router;
