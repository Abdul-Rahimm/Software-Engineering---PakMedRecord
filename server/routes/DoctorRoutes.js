const express = require('express');
const router = express.Router();
const { Signup, Signin, getDoctor,getAllDoctors, deleteDoctor, deleteAllDoctors } = require('../contollers/DoctorController');

// Routes
router.post('/signup', Signup);
router.post('/signin', Signin);
router.get('/home/:doctorCNIC', getDoctor);
 router.get('/doctors', getAllDoctors);
router.delete('/deleteDoctor/:id', deleteDoctor);
router.delete('/deleteAllDoctors', deleteAllDoctors);


module.exports = router;
