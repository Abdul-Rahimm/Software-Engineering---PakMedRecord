const express = require('express');
const router= express.Router();
const {Signup, Signin} = require('../contollers/PatientController');

router.route('/signup').post(Signup);
router.route('/signin').post(Signin);

module.exports = router;
