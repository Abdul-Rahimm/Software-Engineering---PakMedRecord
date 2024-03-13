const express = require('express');
const router= express.Router();
const {Signup, Signin, getPatient} = require('../contollers/PatientController');

router.route('/signup').post(Signup);
router.route('/signin').post(Signin);
router.get('/home/:cnic', getPatient);

module.exports = router;
