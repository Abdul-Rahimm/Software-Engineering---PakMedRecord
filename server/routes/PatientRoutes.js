const express = require('express');
const router= express.Router();
const {Signup, Signin, getPatient, deleteAllPatients, getSignedInPatientCNIC, getAllDoctors} = require('../contollers/PatientController');
const {addNote, getNote} = require('../contollers/NoteController');

router.route('/signup').post(Signup);
router.route('/signin').post(Signin);
router.get('/home/:patientCNIC', getPatient);
router.get('/home/doctors', getAllDoctors);
router.get('/cnic/:id', getSignedInPatientCNIC);
router.delete('/deleteAllPatients', deleteAllPatients);
router.route('/:patientCNIC/addnote').post(addNote);
router.route('/:patientCNIC/getnote').get(getNote);

module.exports = router;
