const express = require('express');
const router= express.Router();
const {Signup, Signin, getPatient, deleteAllPatients} = require('../contollers/PatientController');

router.route('/signup').post(Signup);
router.route('/signin').post(Signin);
router.get('/home/:cnic', getPatient);
router.delete('/deleteAllPatients', deleteAllPatients);


module.exports = router;
