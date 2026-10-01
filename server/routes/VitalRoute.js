const express = require('express');
const router = express.Router();
const { addVital, getVitals, removeVital } = require('../contollers/VitalController');
const { requireAuth, requireSelf, requirePatientAccess } = require('../middleware/auth');

router.use(requireAuth);
router.get('/:patientCNIC', requirePatientAccess('patientCNIC'), getVitals);
router.post('/:patientCNIC', requireSelf('patient', 'patientCNIC'), addVital);
router.delete('/:patientCNIC/:id', requireSelf('patient', 'patientCNIC'), removeVital);

module.exports = router;
