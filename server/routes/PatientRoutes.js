const express = require('express');
const router= express.Router();
const {Signup, Signin, getPatient, updatePatient} = require('../contollers/PatientController');
const {addNote, getNote, removeNote} = require('../contollers/NoteController');
const { requireAuth, requireSelf, requirePatientAccess } = require('../middleware/auth');

router.route('/signup').post(Signup);
router.route('/signin').post(Signin);
router.get('/home/:patientCNIC', requireAuth, requirePatientAccess('patientCNIC'), getPatient);
router.route('/update/:patientCNIC').put(requireAuth, requireSelf('patient', 'patientCNIC'), updatePatient);
router.route('/:patientCNIC/addnote').post(requireAuth, requireSelf('patient', 'patientCNIC'), addNote);
router.route('/:patientCNIC/getnote').get(requireAuth, requireSelf('patient', 'patientCNIC'), getNote);
router.route('/:patientCNIC/removenote/:id').delete(requireAuth, requireSelf('patient', 'patientCNIC'), removeNote);


module.exports = router;
