 const express = require('express');
 const router= express.Router();
 const {Signup, Signin} = require('../contollers/DoctorController');

 router.route('/signup').post(Signup);
 router.route('/signin').post(Signin);

 module.exports = router;
 