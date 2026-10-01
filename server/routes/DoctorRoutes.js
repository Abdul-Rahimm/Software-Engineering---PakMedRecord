const express = require('express');
const router = express.Router();
const { Signup, Signin, getDoctor, getAllDoctors } = require('../contollers/DoctorController');
const { requireAuth } = require('../middleware/auth');

// Routes
router.post('/signup', Signup);
router.post('/signin', Signin);
router.get('/home/:doctorCNIC', requireAuth, getDoctor);
router.get('/doctors', requireAuth, getAllDoctors);

module.exports = router;
