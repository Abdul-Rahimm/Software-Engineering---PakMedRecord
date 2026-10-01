const express = require('express');
const router= express.Router();
const {Signup, Signin, getPatient, updatePatient, updateHealth} = require('../contollers/PatientController');
const {addNote, getNote, removeNote} = require('../contollers/NoteController');
const { requireAuth, requireSelf, requirePatientAccess } = require('../middleware/auth');
const { signinLimiter } = require('../middleware/rateLimit');

router.route('/signup').post(Signup);
router.route('/signin').post(signinLimiter, Signin);
router.get('/home/:patientCNIC', requireAuth, requirePatientAccess('patientCNIC'), getPatient);
router.route('/update/:patientCNIC').put(requireAuth, requireSelf('patient', 'patientCNIC'), updatePatient);
router.route('/:patientCNIC/health').put(requireAuth, requireSelf('patient', 'patientCNIC'), updateHealth);
router.route('/:patientCNIC/addnote').post(requireAuth, requireSelf('patient', 'patientCNIC'), addNote);
router.route('/:patientCNIC/getnote').get(requireAuth, requireSelf('patient', 'patientCNIC'), getNote);
router.route('/:patientCNIC/removenote/:id').delete(requireAuth, requireSelf('patient', 'patientCNIC'), removeNote);


module.exports = router;
