const express = require('express');
const router = express.Router();
const { book, getAppointments, completeAppointment, getAppointmentTimes } = require('../contollers/AppointmentController');

// Routes
router.route('/book/:patientCNIC').post(book);
router.get('/fetch/:doctorCNIC', getAppointments);
router.get('/fetchByTime/:doctorCNIC', getAppointmentTimes);
router.patch('/update/:appointmentId', completeAppointment);
// router.get('/recommend/:doctorCNIC', recommendAppointment);


module.exports = router;
