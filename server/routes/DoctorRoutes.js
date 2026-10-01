const express = require('express');
const router = express.Router();
const { Signup, Signin, getDoctor, getAllDoctors, updateDoctor, getSpecializations } = require('../contollers/DoctorController');
const { requireAuth, requireSelf } = require('../middleware/auth');
const { signinLimiter } = require('../middleware/rateLimit');

// Routes
router.post('/signup', Signup);
router.post('/signin', signinLimiter, Signin);
router.get('/specializations', getSpecializations);
router.get('/home/:doctorCNIC', requireAuth, getDoctor);
router.get('/doctors', requireAuth, getAllDoctors);
router.put('/update/:doctorCNIC', requireAuth, requireSelf('doctor', 'doctorCNIC'), updateDoctor);

module.exports = router;
