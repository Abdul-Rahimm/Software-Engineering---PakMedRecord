const express = require('express');
const router= express.Router();
const {affiliate, getMyDoctors, removeDoctor, getMyPatients} = require('../contollers/AffiliationController');
const { requireAuth, requireRole, requireSelf } = require('../middleware/auth');

router.use(requireAuth);
router.route('/affiliate').post(requireRole('patient'), affiliate);
router.route('/getmydoctors/:patientCNIC').get(requireSelf('patient', 'patientCNIC'), getMyDoctors);
router.route('/getmypatients/:doctorCNIC').get(requireSelf('doctor', 'doctorCNIC'), getMyPatients);
router.route('/remove/:patientCNIC/:doctorCNIC').delete(requireSelf('patient', 'patientCNIC'), removeDoctor);

module.exports = router;
