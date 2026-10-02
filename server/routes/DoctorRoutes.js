const express = require('express');
const router = express.Router();
const { Signup, Signin, getDoctor, getAllDoctors, updateDoctor, getSpecializations, submitVerification, verificationDocument, updateAvailability } = require('../contollers/DoctorController');
const { requireAuth, requireSelf } = require('../middleware/auth');
const { signinLimiter } = require('../middleware/rateLimit');

// Routes
router.post('/signup', Signup);
router.post('/signin', signinLimiter, Signin);
router.get('/specializations', getSpecializations);
router.get('/home/:doctorCNIC', requireAuth, getDoctor);
router.get('/doctors', requireAuth, getAllDoctors);
router.put('/update/:doctorCNIC', requireAuth, requireSelf('doctor', 'doctorCNIC'), updateDoctor);

router.post('/:doctorCNIC/verification', requireAuth, requireSelf('doctor', 'doctorCNIC'), express.raw({ type: () => true, limit: 4 * 1024 * 1024 + 1024 }), submitVerification);
router.get('/:doctorCNIC/verification/document', requireAuth, requireSelf('doctor', 'doctorCNIC'), verificationDocument);
router.put('/:doctorCNIC/availability', requireAuth, requireSelf('doctor', 'doctorCNIC'), updateAvailability);

module.exports = router;
