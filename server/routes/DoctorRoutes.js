const express = require('express');
const router = express.Router();
const { Signup, Signin, getDoctor, deleteDoctor, deleteAllDoctors } = require('../contollers/DoctorController');

// Routes
router.post('/signup', Signup);
router.post('/signin', Signin);
router.get('/home/:cnic', getDoctor);
router.delete('/deleteDoctor/:id', deleteDoctor);
router.delete('/deleteAllDoctors', deleteAllDoctors);

module.exports = router;
