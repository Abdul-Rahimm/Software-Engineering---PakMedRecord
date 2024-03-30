const express = require('express');
const router= express.Router();
const {Signup, Signin, getPatient, deleteAllPatients, getSignedInPatientCNIC, getAllDoctors} = require('../contollers/PatientController');

router.route('/signup').post(Signup);
router.route('/signin').post(Signin);
router.get('/home/:patientCNIC', getPatient);
router.get('/home/doctors', getAllDoctors);
router.get('/cnic/:id', getSignedInPatientCNIC);
router.delete('/deleteAllPatients', deleteAllPatients);


module.exports = router;
