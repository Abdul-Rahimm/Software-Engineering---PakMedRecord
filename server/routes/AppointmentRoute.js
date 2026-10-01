const express = require('express');
const router = express.Router();
const { book, getAppointments, completeAppointment, getAppointmentTimes } = require('../contollers/AppointmentController');
const { requireAuth, requireRole, requireSelf } = require('../middleware/auth');

// Routes
router.use(requireAuth);
router.route('/book/:patientCNIC').post(requireSelf('patient', 'patientCNIC'), book);
router.get('/fetch/:doctorCNIC', requireSelf('doctor', 'doctorCNIC'), getAppointments);
router.get('/fetchByTime/:doctorCNIC', requireSelf('doctor', 'doctorCNIC'), getAppointmentTimes);
router.patch('/update/:appointmentId', requireRole('doctor'), completeAppointment);
// router.get('/recommend/:doctorCNIC', recommendAppointment);


module.exports = router;
